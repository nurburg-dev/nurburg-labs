---
title: "Black Friday Authentication Crisis"
tags: [postgres, debugging]
summary: "It's Black Friday and your authentication system is crashing! Users are waiting 10+ seconds to log in because of a missing database index. Learn how to diagnose and fix this critical performance issue."
author: Anunay Biswas
authorLink: "https://github.com/anunaybiswas"
authorTitle: "Software Engineer"
intent: "challenge"
draft: false
publishedOn: 2026-07-01
challengeDetails:
  id: 0000
  difficulty: "easy"
  points: 100
  language: "python"
---

## The Incident

It's Black Friday. Your e-commerce platform is running a 50% off sale. Thousands of users are trying to log in, and every login is taking 10+ seconds. Customers are rage-quitting. Revenue is bleeding. Your phone won't stop buzzing with enquiries from business teams.

The login API hits the `users` table on `email`. Something about this API is extremely slow.

## Setup

### Install dependencies

```bash
make install
```

### Load schema

```bash
PGPASSWORD=password psql -h userdb -U user -d userdb -f schema.sql
```

### Load data

```bash
wget -O- https://nurburg-dev-fluentbit.s3.eu-central-1.amazonaws.com/0000-users-dev.csv | \
  PGPASSWORD=password psql -h userdb -U user -d userdb -c "\COPY users FROM STDIN CSV HEADER"
```

### Start service

```bash
make run
```

## See It Break

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "yvette52@example.org", "password": "password123"}'
```

The local dataset is only ~55 rows — too small to feel slow. Locally the login will complete in milliseconds regardless of the bug. The performance collapse only shows up at 5M users (production scale).

### Diagnose with a query plan

Since you can't feel the slowness locally, use `EXPLAIN ANALYZE` to see _how_ Postgres is executing the login query:

```bash
PGPASSWORD=password psql -h userdb -U user -d userdb
```

```sql
EXPLAIN ANALYZE
SELECT id, password_hash FROM users WHERE email = 'yvette52@example.org';
```

On the local 55-row dataset you'll see output like this:

```
                                         QUERY PLAN
--------------------------------------------------------------------------------------------
 Seq Scan on users  (cost=0.00..1.69 rows=1 width=65) (actual time=0.048..0.052 rows=1 loops=1)
   Filter: ((email)::text = 'yvette52@example.org'::text)
   Rows Removed by Filter: 54
 Planning Time: 0.196 ms
 Execution Time: 0.081 ms
```

#### How to read it

- `Seq Scan` — Postgres read every row in the table looking for a match. This is the problem.
- `Rows Removed by Filter: 54` — it scanned all 55 rows and discarded 54. At 5M rows that's 4,999,999 wasted reads per login.
- `actual time=0.048..0.052` — looks fine locally because 55 rows is nothing. At 5M rows this number explodes.
- `Index Scan` — what you want to see instead. Postgres jumps directly to the matching row, no scan needed.

**The signal to look for:** `Seq Scan` on a table being filtered by a column. That column needs an index.

## Your Task

The login query filters users by `email`. Without an index, Postgres does a full table scan on every login request — every row, every time.

Your task is to fix this. Add the right database index to `schema.sql`, then apply it to your local database:

```bash
PGPASSWORD=password psql -h userdb -U user -d userdb
```

```sql
<your index here>
```

Verify your fix worked by running `EXPLAIN ANALYZE` again. The query plan must no longer show `Seq Scan on users` — you should see `Index Scan` instead.

**Success criteria while testing on production** (evaluated at 5M users):

- `p95 < 500ms`
- `error rate < 1%`

## Constraints

1. Don't modify anything inside `.nurburgdev/` - that directory is owned by the eval engine.
2. The fix must be in `schema.sql`. The eval engine applies this file when loading the 5M user dataset.
3. Don't alter the existing `users` table schema.

<details>
    <summary>Hint</summary>
    The query filters by email. What database feature speeds up column lookups?
    Read up on <a href="https://www.postgresql.org/docs/current/indexes-intro.html">Postgres indexes</a> — specifically the B-tree type, which is the default and handles equality lookups like <code>WHERE email = ?</code>.
</details>
