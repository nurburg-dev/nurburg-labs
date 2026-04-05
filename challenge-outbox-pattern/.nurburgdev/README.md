---
title: "Outbox Pattern"
author: "Anunay Biswas"
authorLink: "https://github.com/anunaybiswas"
authorTitle: "Software Engineer"
summary: "Implement the transactional outbox pattern to reliably publish events to Kafka after a database write."
publishedOn: 2026-04-01
tags: [kafka, postgres, distributed-systems]
intent: "challenge"
draft: true
challengeDetails:
  id: 0001
  difficulty: "hard"
  points: 300
  language: "typescript"
---

## The situation

Your payments team just shipped a feature: every order placed by a customer gets mirrored into a ledger service for finance reporting. The integration looks simple— the order service publishes an `order.created` event to Kafka, and the ledger service consumes it. Everything worked fine during testing.

Then in production order-service's PostgreSQL server experienced an outage. During the outage, every `POST /orders` returned a 500. After recovering from this next day Finance team is asking why their ledger totals don't match order totals. Finance ledger seems to have orders which doesn't exist in orders database. Ledger entries are immuable because of several accounting and legal reasons. Finance team can't simply delete these phantom entries. Finance team should now have to manually create thousands of credit notes manually.

Your job: debug how can this happened and fix it so that order-service and ledger-service becomes transactional under any circumstance?

## Your dev environment on nurburg.dev

The environment has two Node.js services, two Postgres databases, and a Kafka cluster pre-provisioned for you.

| Resource         | Detail                                          |
|------------------|-------------------------------------------------|
| `order-service`  | port `3000`, database `orderdb` on `pg-orders`  |
| `ledger-service` | port `4000`, database `ledgerdb` on `pg-ledger` |
| Kafka topic      | `outbox-events`                                 |

### Starting the services

Run each service in a separate terminal from its directory:

```bash
# order-service
cd order-service && npm run dev

# ledger-service
cd ledger-service && npm run dev
```

## Connecting to the databases

```bash
# order-service database
cd order-service && npm run psql

# ledger-service database
cd ledger-service && npm run psql
```

## Schema files

⚠️ BEFORE STARTING DEVELOPMENT ⚠️

1. `order-service/schema.sql` has the schema for `order-service`. Apply the schema before development- using `npm run psql -- -f schema.sql`
2. `ledger-service/schema.sql` defines the `ledger_entries` table. Apply the schema before development- using `npm run psql -- -f schema.sql`
3. existing table schemas shouldn't be altered in any way. New tables could be added to schema.sql. For development you should manually create these tables by connecting to Postgres from command-line tool as describe in the preceding section.

## Hitting the API

You should use curl commands to check for API behavior

```bash
# Create an order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId": "customer-1", "amount": 100, "currency": "USD"}'

# Check order total
curl http://localhost:3000/orders/total

# Check ledger total
curl http://localhost:4000/ledger/total
```

## Observable symptoms

The current implementation publishes to Kafka before committing the transaction. Reproduce the failure:

1. Start both services `order-service` and `ledger-service` using commands from the section "Starting the services" . Try creating few orders using curl. You'll get few failures in the begining and then all succcesses.
2. Compare orders total and ledgers total. You'll notice orders total is less than ledgers total.

## The task

Implement the transactional outbox pattern in `order-service`:

1. Add an `outbox` table to `order-service/schema.sql`. Each row holds the serialised event payload and a `published` flag. Remember to create this table in order-service's database by connecting to the database.`
2. In `POST /orders`, write the `orders` row and an `outbox` row in the **same transaction**. Remove the synchronous Kafka `producer.send` from the request path entirely.
3. Add a background **relay process** using a `setInterval` loop in the same process— that polls unpublished outbox rows, produces them to Kafka, and marks them `published = true`.
4. `ledger-service` must consume `outbox-events` and persist entries to `ledger_entries` so that `GET /ledger/total` reflects all processed orders.

🏆 Success criteria- After posting 10 orders and waiting a few seconds, even if you observe failures while creating orders the total should match after a few seconds. 🏆

## Constraints

1. Use `nurburg-libs` for all database (`PgPool`) and Kafka (`Kafka`) clients. Direct use of `pg` or `kafkajs` bypasses test harness instrumentation. This'll break scoring.
2. Don't modify anything inside `.nurburgdev/` — that directory is owned by the eval engine.
3. Don't alter the `orders` table schema in `order-service/schema.sql`; you may add new tables.
4. Don't alter the `ledger_entries` table schema in `ledger-service/schema.sql`.
5. `GET /healthcheck` on both services must always return `200 OK`, regardless of Kafka or database state.

## Evaluation criteria

- **Functional tests** The test suite posts 10 orders while simulating failures, waits 5 seconds. Then it checks if `ledger_service` and `order_service` totals are matching.

## Hints

<details>
<summary>Hint 1— outbox table shape</summary>

Your outbox table needs at minimum: a primary key, the serialised event payload, a `published` boolean defaulting to `false`, and a `created_at` timestamp. Something like:

```sql
CREATE TABLE outbox (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  payload    JSONB   NOT NULL,
  published  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

</details>

<details>
<summary>Hint 2— safe polling under concurrency</summary>

If you ever run multiple relay instances, two workers could pick up the same row. Use `SELECT ... FOR UPDATE SKIP LOCKED` to grab a batch of unpublished rows without contention:

```sql
SELECT * FROM outbox
WHERE published = false
ORDER BY created_at
LIMIT 10
FOR UPDATE SKIP LOCKED;
```

</details>

## What you're actually learning

- **Transactional outbox pattern** Writing events to a database table inside the same transaction as the domain record, then relaying them asynchronously. [Read more](https://nurburg.dev/nurburg-dev/nurburg-labs:blog-outbox-pattern)
- **Dual-write problem** Why writing to two systems (DB + message broker) in sequence is fundamentally unreliable.
- **At-least-once delivery** The relay may publish a message more than once if it crashes between send and mark-published. Consumers should be idempotent.
- **`FOR UPDATE SKIP LOCKED`** A Postgres primitive that makes polling queues safe under concurrent workers without explicit locking overhead.
