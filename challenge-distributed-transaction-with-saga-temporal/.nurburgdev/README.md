---
title: "Distributed Transaction with Saga and Temporal"
author: "Anunay Biswas"
authorLink: "https://github.com/anunaybiswas"
authorTitle: "Software Engineer"
summary: "Implement the Saga pattern to coordinate a distributed transaction across PostgreSQL and MySQL services using Temporal for workflow orchestration."
publishedOn: 2026-04-03
tags: [temporal, postgres, mysql, distributed-systems]
intent: "challenge"
draft: true
challengeDetails:
  id: 0004
  difficulty: "hard"
  points: 300
  language: "typescript"
---

## The situation

You are an engineer at SkyConnect, a multi-airline booking platform. Airlines are reporting that several seats in their flight are getting blocked even though customers aren't receiving confirmation of the booking.

Digging into the logs, you find that `booking-service` calls the two airline HTTP APIs sequentially. When airline-2's API times out few times the seats on airline-2 stays blocked. A reverse compensation mechnaism has been implemented but it doesn't seem to be taking effect. Your job is to evaluate the correctness of current architecture and implement the required fixes.

## Your dev environment on nurburg.dev

You have three services, two PostgreSQL databases, one MySQL database, and a Temporal server pre-provisioned:

| Service             | Port | Database                  |
|---------------------|------|---------------------------|
| `booking-service`   | 3000 | PostgreSQL— `bookingdb`   |
| `airline-1-service` | 4000 | PostgreSQL— `airline1db`  |
| `airline-2-service` | 5000 | MySQL— `airline2db`       |

Temporal is available at `temporal:7233`. The saga runs as a Temporal workflow started by `booking-service`. Airline services run as activity workers on the `booking-saga` task queue:

| Service             | Role                  |
|---------------------|-----------------------|
| `booking-service`   | Workflow orchestrator |
| `airline-1-service` | Activity worker       |
| `airline-2-service` | Activity worker       |

### Start all services

Open three terminals, one per service:

```bash
# Terminal 1 — booking-service (port 3000)
cd booking-service && npm run dev
```

```bash
# Terminal 2 — airline-1-service (port 4000)
cd airline-1-service && npm run dev
```

```bash
# Terminal 3 — airline-2-service (port 5000)
cd airline-2-service && npm run dev
```

### Connect to databases

```bash
# booking-service db (PostgreSQL)
cd booking-service && npm run psql
```

```bash
# airline-1-service db (PostgreSQL)
cd airline-1-service && npm run psql
```

```bash
# airline-2-service db (MySQL)
cd airline-2-service && npm run mysql
```

### Schema files and data ingestion

The schema files define the existing tables and seed data. Run them once to initialise each database:

```bash
# booking-service (PostgreSQL)
cd booking-service && npm run psql -- -f schema.sql
```

```bash
# airline-1-service (PostgreSQL)
cd airline-1-service && npm run psql -- -f schema.sql
```

```bash
# airline-2-service (MySQL)
cd airline-2-service && npm run mysql -- < schema.sql
```

#### Current schema details

- `booking-service/schema.sql` contains `bookings` table
- `airline-1-service/schema.sql` contains `flights` and `flight_bookings` tables (PostgreSQL), seeded with two flights on 2026-04-10 and 2026-04-11
- `airline-2-service/schema.sql` `flights` and `flight_bookings` tables (MySQL), seeded with two flights on 2026-04-10 and 2026-04-11

⚠️ **Don't modify the existing tables or seed data in these files.** ⚠️

### If your solution requires a new table

1. add the table schema to the relevant `schema.sql` file
2. apply it manually in your development environment. Connect to the database in terminal using the previously mentioned commands and execute `CREATE TABLE` queries.

## Understanding how transactionality is broken

The Saga pattern breaks a distributed transaction into a sequence of local transactions, each paired with a compensating action that can undo it if a later step fails. Saga pattern relies on each participant being able to roll back its own step independently. When the orchestrator crashes mid-saga or a compensation call itself fails, partial state leaks through. [Read more about the Saga pattern](https://nurburg.dev/nurburg-dev/nurburg-labs:blog-distributed-transaction-with-saga-temporal).

The current implementation of saga lives in `booking-service/src/bookingDBService.ts` in the `orchestrateBookingSaga` method. It calls `airline1.blockFlightBooking` then `airline2.blockFlightBooking` via direct HTTP.

If you carefully go through the technical details of how to implement saga correctly you would notice that a saga implementation should implement "reliable exectution" - which means all the steps should reliably be executed to success or failure. For example

1. Execution of saga steps shouldn't abruptly stop.
2. The saga implementation shouldn't be under the impression that a step has succeeded when it has failed or a step has failed when indeed it has actually succeed.

_Implementing saga as a simple function isn't correct_ because a function can fail anytime while executing. Also _using HTTP calls for each step is incorrect_ as well because HTTP calls can break transactionality in several ways. For example- If airline-2 HTTP call times out, the ticket blocked in airline-1 would be immediately cancels. But airline-2's ticket might have already been booked while the HTTP call was timing out. Now the system's 3 databases have conflicting data

- `booking-service` the booking is cancelled
- `airline-1-service` airline-1 ticket is cancelled
- `airline-2-service` but airline-2's ticket is blocked.

## The task

Replace the direct HTTP calls in the saga orchestration with a Temporal workflow. The `booking-service` must start a Temporal workflow instead of calling airline HTTP APIs directly.

Each airline service registers Temporal activities that perform their local transaction and return a result. On activity failure, the workflow must execute compensating activities to release already-blocked seats.

A booking is complete only when the workflow successfully completes all activities and transitions the booking to `CONFIRMED`. A service restart must not lose an in-progress saga — Temporal durably persists workflow state.

### How to test correctness of saga?

### Step 1 - Execute API for booking flights

Start all three services, then use the following curl call to trigger a booking:

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

Run this 5–10 times. After a few requests, query the airline databases to verify the internal database states:

### Step 2: Connect to airline-1's database and Check for blocked flight seats inventory

```bash
cd airline-1-service && npm run psql
```

```sql
SELECT booking_id, status, created_at FROM flight_bookings WHERE status = 'BLOCKED';
```

This query should show no flight bookings.

⚠️ In a transactional Saga implementation blocked seats should be automatically reversed via compensation operation. But here several seats are stuck in blocked state ⚠️

Verify the same in `airline-2-service`'s db as well.

```bash
cd airline-2-service && npm run mysql
```

```sql
SELECT booking_id, status, created_at FROM flight_bookings WHERE status = 'BLOCKED';
```

Another verification you must do matching the number of CONFIRMED booking across the 2 airlines and booking service

## Constraints

1. Each airline service must register its own activity implementations on the `booking-saga` task queue.
2. Don't modify any files inside `.nurburgdev/`.
3. Don't change any API's other than `POST /bookings`
4. While you should change the implementation `POST /bookings` API, the contract should remain unchanged.

## Evaluation criteria

1. All `/healthcheck` endpoints return `200 OK` at all times, including during saga execution.
2. A POST to `/bookings` returns `{ bookingId }` immediately with `200 OK` and then the saga runs asynchronously.
3. After a successful saga, the booking record in `bookingdb` has `status = 'CONFIRMED'` and both airline `flight_bookings` records have `status = 'CONFIRMED'`.
4. When `airline-2` fails, the `airline-1` `flight_bookings` record should be compensated back. No rows stuck in `BLOCKED`.
5. Restarting `booking-service` mid-saga shouldn't leave the saga in an unrecoverable state.

## Hints

<details>
<summary>Where do I start?</summary>
Look at `booking-service/src/bookingDBService.ts` — the `orchestrateBookingSaga` method makes HTTP calls directly. That's the method to rework. Each `await airline1.blockFlightBooking(...)` call should become a Temporal activity invocation inside a workflow instead.
</details>

<details>
<summary>How should the Temporal workflow look?</summary>

booking-service starts a workflow  →  Temporal dispatches activities  →  airline-1-service worker executes blockFlightBooking activity
                                                                      →  airline-2-service worker executes blockFlightBooking activity

On failure, the workflow runs compensating activities in reverse:

airline-1-service worker executes cancelFlightBooking activity  ←  Temporal dispatches compensation  ←  workflow catches the error

Each activity should accept `{ bookingId, flightDate, seatCount }` for block, and `{ bookingId }` for confirm and cancel.
</details>

## What you're actually learning

- **Saga orchestration pattern** coordinating multi-step transactions across independent services without a distributed lock.
- **Temporal as a workflow engine** using durable workflows and activities instead of a message bus.
- **Compensating activities** designing reversible steps so partial failures leave no inconsistency.
- **Durable execution** Temporal persists workflow state so restarts never orphan in-flight transactions.

### Further reading

- [The Saga pattern](https://nurburg.dev/nurburg-dev/nurburg-labs:blog-distributed-transaction-with-saga-temporal).
- [Outbox pattern](https://nurburg.dev/nurburg-dev/nurburg-labs:blog-outbox-patter)
