---
title: "Fix the Hidden OFFSET Bottleneck in Your Pagination API"
author: "nurburg-dev"
authorLink: "https://github.com/nurburg-dev"
authorTitle: "Software Engineer"
summary: "A cursor pagination API that secretly uses OFFSET under the hood is grinding your product catalog to a halt. Replace the OFFSET with a real keyset query before the on-call pager fires again."
publishedOn: 2026-06-20
tags: [postgres, scalability, debugging]
intent: "challenge"
draft: true
challengeDetails:
  id: 8
  difficulty: "medium"
  points: 200
  language: "python"
---

## The Situation

Your team runs the product catalog API for a fashion marketplace — 500,000 products, browsable via a "Load More" button that shipped three weeks ago. Nobody noticed anything wrong until this morning, when a customer reported that scrolling deep into search results took nearly five seconds per page. The on-call engineer confirmed it immediately: early pages load in milliseconds, but by page 5,000 the response time has crept past four seconds and the database pod's CPU is spiking.

The API looks correct on paper. It accepts a `cursor` parameter and returns a `next_cursor` on every response, which is what cursor-based pagination is supposed to do. Open `src/index.py` and you'll see the problem: the cursor is decoded as a **page number**, then multiplied by `limit` to produce a SQL `OFFSET`. PostgreSQL has to scan and discard hundreds of thousands of rows on every deep-page request — every single time, for every user.

## Your Dev Environment on nurburg.dev

Your environment comes pre-provisioned with a Python FastAPI service connected to a PostgreSQL database seeded with 500,000 product rows.

**Install dependencies and start the server:**

```bash
make install
make run
```

**Connect to the database (password: `password`):**

```bash
make db
```

**Test shallow vs deep pagination and see the latency gap:**

```bash
make test-compare
```

The schema lives in `.nurburgdev/schema.sql`. The query logic you need to fix is in `src/index.py` in the `get_products` function.

## Observable Symptoms

1. Start the server: `make run`
2. Fetch the first page — should respond in under 10ms: `make test-shallow`
3. Fetch a deep page using a high cursor value — watch the response time climb past 2 seconds: `make test-deep`

The gap between those two commands is the bottleneck you need to eliminate.

## The Task

Replace the OFFSET-based implementation in `src/index.py` with true keyset (cursor) pagination. The endpoint signature must stay the same:

- Accepts `cursor` (optional string) and `limit` (integer) query parameters
- Returns a `products` array and a `next_cursor` string field (or `null` when there are no more pages)

Your fix must execute in **constant time** regardless of how deep into the catalog the client has paged.

## Constraints

1. You may only modify files inside the service directory: `src/`, `requirements.txt`, `Procfile`, and `Makefile`.
2. Changes to `.nurburgdev/` are off-limits.
3. You may not use `OFFSET` anywhere in your solution.
4. You may not add a caching layer (Redis, memcached, etc.).

## Evaluation Criteria

The evaluator runs a k6 load test that fetches deep catalog pages using cursor values that correspond to 100,000–200,000 rows into the result set. Your solution must pass all three gates:

| Score | Threshold | What it checks |
|---|---|---|
| `FUNC_TEST` | ≥ 100% | API contract: correct shape and non-empty results |
| `ERR_RATE` | < 5% | No crashes or 5xx errors under load |
| `LATENCY_95` | < 200ms | P95 response time on deep pages |

The stock OFFSET implementation typically scores 2,000–4,000ms at P95 for these cursor depths. A correct keyset implementation should score under 10ms.

## Hints

<details>
<summary>Hint 1 — Where is the OFFSET hiding?</summary>

Look at how `cursor` is decoded in the `get_products` function. It's parsed as a page number, then converted to an OFFSET: `offset = (page - 1) * limit`. That arithmetic is the root cause.
</details>

<details>
<summary>Hint 2 — What should a cursor actually encode?</summary>

A cursor should encode the **identity** of the last row returned, not its position in the sequence. The `id` column is a BIGSERIAL primary key — it has a unique index built in. Change your query to `WHERE id < :cursor ORDER BY id DESC LIMIT :limit` and you get a constant-time index seek instead of a linear scan.
</details>

<details>
<summary>Hint 3 — How do I encode the next cursor?</summary>

After fetching your page of results, take the `id` of the **last** row in the list and return `str(last_id)` as `next_cursor`. The next request will use that value in the WHERE clause, giving PostgreSQL a precise starting point with no rows to skip.
</details>

## What You're Actually Learning

**Cursor pagination vs OFFSET pagination** — `LIMIT 20 OFFSET N` forces the database to read and discard N rows to find your 20. `WHERE id < N ORDER BY id DESC LIMIT 20` lets PostgreSQL jump directly to the right place in the index. The first is O(N); the second is O(1).

**Index-aware query design** — the fix works because `id` is a primary key. PostgreSQL can satisfy `WHERE id < N ORDER BY id DESC LIMIT 20` with a single backwards index scan, touching only 20 rows.
