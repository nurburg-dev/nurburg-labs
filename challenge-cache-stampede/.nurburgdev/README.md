---
title: "Cache Stampede: Surviving a Hot Key Expiry at 10k RPS"
author: "Anunay Biswas"
authorLink: "https://github.com/anunaybiswas"
authorTitle: "Software Engineer"
summary: "A single cache TTL expiry sends every concurrent request straight to Postgres. CPU saturates and p95 latency blows up. Fix it."
publishedOn: 2026-04-27
tags: [redis, postgres, scalability]
intent: "challenge"
draft: true
challengeDetails:
  id: 0005
  difficulty: "hard"
  points: 300
  language: "typescript"
---

## The Incident

Your e-commerce platform just launched a flash sale. One product is everywhere — homepage banners, push notifications, social ads. Traffic ramps from a quiet 100 RPS to 10,000 RPS in under two minutes.

For the first 60 seconds everything looks fine. Postgres is idle. Redis is serving the product page from cache. Then the TTL expires.

Every one of the 10,000 in-flight requests misses the cache at the same instant. Every one races to Postgres. The query is simple — a single primary-key lookup — but 10,000 of them in parallel saturate the connection pool. Postgres CPU pins at 100 %. P95 latency jumps from 8 ms to 4 seconds. Your monitoring fires. Revenue stops.

This is the cache stampede. It is a structural failure, not a bug, and a 60-second TTL is all it takes.

## Your dev environment on nurburg.dev

The environment has one Go service, a PostgreSQL database, and a Redis instance pre-provisioned.

| Resource    | Detail                                                |
|-------------|-------------------------------------------------------|
| `app`       | Go HTTP service on port `3000`                        |
| `productdb` | PostgreSQL — `productdb` database, user `user`        |
| `cache`     | Redis standalone on port `6379`                       |

### Starting the service

```bash
npm install
npm run dev
```

### Connecting to the database

```bash
npm run psql
```

### Loading the schema

```bash
npm run psql -- -f schema.sql
```

### Hitting the hot endpoint

```bash
# Warm the cache
curl http://localhost:3000/product/1

# Watch cache state in Redis
redis-cli TTL product:1
```

## Observable Symptoms

Reproduce the stampede locally:

1. Start the service with `go run ./src`.
2. Warm the cache: `curl http://localhost:3000/product/1`.
3. Wait 60 seconds for the TTL to expire, or flush Redis: `redis-cli FLUSHALL`.
4. Fire a burst of concurrent requests:

```bash
for i in $(seq 1 200); do curl -s http://localhost:3000/product/1 & done; wait
```

5. Watch Postgres connections spike in a separate terminal:

```bash
PGPASSWORD=password psql -h localhost -U user -d productdb \
  -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

At 200 concurrent requests all hitting a cold cache you will see dozens of simultaneous active connections — the stampede in miniature.

## The Task

The starter code already implements the basic cache-aside pattern with a 60-second TTL. Under the load test that pattern collapses. Your job is to add stampede protection so that `LATENCY_95` stays below 300 ms and `POSTGRESQL_CPU` stays below 60 % even as traffic ramps to its peak.

Choose one or more of the standard mitigations — single-flight coalescing, jittered TTLs, stale-while-revalidate, or probabilistic early expiration (XFetch) — and implement it in `src/main.go`.

## Constraints

1. The `/healthcheck` endpoint must always return `200 OK`.
2. The `/product/:id` endpoint must return the product as JSON with `id`, `name`, `description`, and `price` fields.
3. Do not increase `cpuCores` or `memoryMB` in `experiment.toml` — the fix must be algorithmic.
4. Do not change the Postgres schema or add read replicas.
5. Do not modify anything inside `.nurburgdev/` — that directory is owned by the eval engine.

## Evaluation Criteria

- **Error rate** — HTTP error rate during the load test must stay below 5 %.
- **Latency** — P95 response latency must stay below 300 ms under peak traffic.
- **Postgres CPU** — peak PostgreSQL CPU must stay below 60 %.
- **Functional tests** — the `/healthcheck` and `/product/1` tests must pass.

## Hints

<details>
<summary>Hint 1 — single-flight / request coalescing</summary>

The Go standard library ships `golang.org/x/sync/singleflight`. Wrap the cache-miss path so that only one goroutine fires the Postgres query for a given key; every other concurrent miss waits and shares the result. Two lines of code can collapse thousands of simultaneous DB hits into one.

```go
result, err, _ := group.Do(key, func() (interface{}, error) {
    return fetchFromDB(ctx, id)
})
```

</details>

<details>
<summary>Hint 2 — jittered TTL</summary>

Instead of a hard 60-second TTL for every request, add a random offset:

```go
ttl := 60*time.Second + time.Duration(rand.Intn(30))*time.Second
```

This spreads expiry across a 30-second window so the herd never assembles at one moment.

</details>

<details>
<summary>Hint 3 — XFetch (probabilistic early expiration)</summary>

XFetch re-fetches a cache entry *before* it expires with a probability that rises as the TTL shrinks. Store a `delta` (how long the last fetch took) alongside the value, and recompute on each read:

```
now + delta * beta * ln(rand()) > expiry_time  →  refresh
```

With `beta = 1.0` this gives behaviour equivalent to optimal early expiration without any coordination.

</details>

## What You're Actually Learning

- **Cache stampede / thundering herd** The structural failure mode where simultaneous cache misses overload the origin. [Read more](https://nurburg.dev/nurburg-dev/nurburg-labs:blog-slack-caching-outage)
- **Single-flight / request coalescing** Deduplicating concurrent in-flight requests for the same resource.
- **Jittered TTLs** Spreading cache expiry times to prevent synchronised misses.
- **XFetch** Probabilistic early cache refresh — the simplest stampede fix that requires no coordination.
- **Stale-while-revalidate** Serving a stale cached value while asynchronously refreshing it in the background.
