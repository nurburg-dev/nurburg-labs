---
title: "Distributed Transaction with Saga and Kafka"
author: "Anunay Biswas"
authorLink: "https://github.com/anunaybiswas"
authorTitle: "Software Engineer"
summary: "Implement the Saga pattern to coordinate a distributed transaction across PostgreSQL and MySQL services using Kafka for messaging."
publishedOn: 2026-04-03
tags: [kafka, postgres, mysql, distributed-systems]
intent: "challenge"
draft: true
challengeDetails:
  id: 0003
  difficulty: "hard"
  points: 300
  language: "typescript"
---

## The situation

You are an engineer at SkyConnect, a multi-airline booking platform. Customer support has been escalating complaints — passengers are receiving booking confirmation emails but when they show up at the gate, the airline has their seat marked as **BLOCKED**, not confirmed. The ticket never fully completed.

Digging into the logs, you find that `booking-service` calls the two airline HTTP APIs sequentially. When airline-2's API times out or returns an error, the saga stops — but airline-1's seat is already blocked with no one to release it. The system has no way to roll back partial progress, and no way to retry a failed saga after a restart.

Your job is to replace the naive HTTP-chained orchestration with a Kafka-backed Saga so that every booking either fully completes or fully compensates — across both airlines and the booking database.

## Your dev environment on nurburg.dev

You have three services, two PostgreSQL databases, one MySQL database, and a Kafka cluster pre-provisioned:

| Service | Port | Database |
|---|---|---|
| `booking-service` | 3000 | PostgreSQL — `bookingdb` |
| `airline-1-service` | 4000 | PostgreSQL — `airline1db` |
| `airline-2-service` | 5000 | MySQL — `airline2db` |

Kafka is available at `kafka:9092` with three topics you must use:

| Topic | Consumer |
|---|---|
| `airline-1` | `airline-1-service` |
| `airline-2` | `airline-2-service` |
| `booking-service` | `booking-service` |

**Start all services:**

Open three terminals, one per service:

```bash
# Terminal 1 — booking-service (port 3000)
cd booking-service && npm run dev

# Terminal 2 — airline-1-service (port 4000)
cd airline-1-service && npm run dev

# Terminal 3 — airline-2-service (port 5000)
cd airline-2-service && npm run dev
```

**Connect to databases:**

```bash
# booking-service db (PostgreSQL)
cd booking-service && npm run psql

# airline-1-service db (PostgreSQL)
cd airline-1-service && npm run psql

# airline-2-service db (MySQL)
cd airline-2-service && npm run mysql
```

**Schema files and data ingestion:**

The schema files define the existing tables and seed data. Run them once to initialise each database:

```bash
# booking-service (PostgreSQL)
cd booking-service && npm run psql -- -f schema.sql

# airline-1-service (PostgreSQL)
cd airline-1-service && npm run psql -- -f schema.sql

# airline-2-service (MySQL)
cd airline-2-service && npm run mysql -- < schema.sql
```

- `booking-service/schema.sql` — `bookings` table
- `airline-1-service/schema.sql` — `flights` and `flight_bookings` tables (PostgreSQL), seeded with two flights on 2026-04-10 and 2026-04-11
- `airline-2-service/schema.sql` — `flights` and `flight_bookings` tables (MySQL), seeded with two flights on 2026-04-10 and 2026-04-11

**Do not modify the existing tables or seed data in these files.** If your solution requires a new table, add it to the relevant `schema.sql` and apply it manually via the CLI in your dev environment:

```bash
# PostgreSQL — run a single statement
cd booking-service && npm run psql -- -c "CREATE TABLE IF NOT EXISTS ..."

# MySQL — run a single statement
cd airline-2-service && npm run mysql -- -e "CREATE TABLE IF NOT EXISTS ..."
```

## Observable symptoms

Start all three services, then send a few bookings:

```bash
curl -s -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-1",
    "amount": 450.00,
    "seats": 1,
    "date": "2026-04-10",
    "flightLegs": [
      { "airlines": "airline-1", "flightNumber": "A1-101" },
      { "airlines": "airline-2", "flightNumber": "A2-201" }
    ]
  }'
```

Run this 5–10 times. After a few requests, query the airline databases:

```bash
# airline-1-service (PostgreSQL)
cd airline-1-service && npm run psql
```

```sql
SELECT booking_id, status, created_at FROM flight_bookings WHERE status = 'BLOCKED';
```

```bash
# airline-2-service (MySQL)
cd airline-2-service && npm run mysql
```

```sql
SELECT booking_id, status, created_at FROM flight_bookings WHERE status = 'BLOCKED';
```

You will see rows stuck in `BLOCKED` on `airline-1` with no matching `BLOCKED` or `CONFIRMED` row on `airline-2`. Airline-1 has decremented its `available_seat_count` and will never release it — that inventory is gone. The booking record in `bookingdb` is either missing or stuck in `PENDING`.

## The task

Replace the direct HTTP calls in the saga orchestration with Kafka events. The `booking-service` must publish commands to the `airline-1` and `airline-2` topics. Each airline service consumes its topic, performs its local transaction, and publishes a reply to the `booking-service` topic. On any failure reply, `booking-service` must publish compensating commands to release already-blocked seats.

A booking is complete only when `booking-service` receives success replies from both airlines and transitions the booking to `CONFIRMED`. A service restart must not lose an in-progress saga.

## Constraints

1. Each Kafka topic must be consumed only by its designated service — `airline-1` by `airline-1-service`, `airline-2` by `airline-2-service`, `booking-service` by `booking-service`.
2. Do not revert to synchronous HTTP calls between services for saga steps.
3. Do not modify any files inside `.nurburgdev/`.
4. Use `nurburg-libs` for any Kafka client or database pool instantiation.

## Evaluation criteria

- All `/healthcheck` endpoints return `200 OK` at all times, including during saga execution.
- A POST to `/bookings` returns `{ bookingId }` immediately with `200 OK` — the saga runs asynchronously.
- After a successful saga, the booking record in `bookingdb` has `status = 'CONFIRMED'` and both airline `flight_bookings` records have `status = 'CONFIRMED'`.
- When `airline-2` fails, the `airline-1` `flight_bookings` record is compensated back — no rows stuck in `BLOCKED`.
- Restarting `booking-service` mid-saga does not leave the saga in an unrecoverable state.

## Hints

<details>
<summary>Where do I start?</summary>
Look at `booking-service/src/bookingDBService.ts` — the `orchestrateBookingSaga` method makes HTTP calls directly. That is the method to rework. Each `await airline1.blockFlightBooking(...)` call should become a Kafka publish instead.
</details>

<details>
<summary>How should the Kafka message flow look?</summary>

booking-service  →  airline-1 topic  →  airline-1-service
booking-service  →  airline-2 topic  →  airline-2-service
airline-1-service  →  booking-service topic  →  booking-service
airline-2-service  →  booking-service topic  →  booking-service

Each message should carry a `bookingId`, a `type` (e.g. `BLOCK`, `CONFIRM`, `CANCEL`), and a `status` on replies (`SUCCESS` or `FAILURE`).
</details>

<details>
<summary>How do I survive a restart?</summary>
The `bookings` table already has a `status` column. Persist saga state transitions there (or in a separate `saga_state` table) before publishing each Kafka command. On startup, query for in-progress sagas and resume them.
</details>

## What you're actually learning

- **Saga orchestration pattern** — coordinating multi-step transactions across independent services without a distributed lock.
- **Kafka as a command bus** — using topics per participant rather than a shared event log.
- **Compensating transactions** — designing reversible steps so partial failures leave no inconsistency.
- **Durable saga state** — persisting orchestrator state so restarts don't orphan in-flight transactions.

Further reading:

- [Outbox pattern](https://nurburg.dev/nurburg-dev/nurburg-labs:challenge-distributed-transaction-with-outbox-and-decouple-write) — atomically publishing Kafka events alongside database writes.
