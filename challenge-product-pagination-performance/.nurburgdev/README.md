---
title: "Speed Up Deep Product Catalog Pagination"
author: "nurburg-dev"
authorLink: "https://github.com/nurburg-dev"
authorTitle: "Software Engineer"
summary: "A large catalog feed works for shallow browsing but slows down as clients page deeper into a hot category. Redesign pagination so latency stays predictable."
publishedOn: 2026-06-20
tags: [postgres, scalability, debugging]
intent: "challenge"
draft: false
challengeDetails:
  id: 8
  difficulty: "medium"
  points: 200
  language: "python"
---

## The Situation

Your team runs a marketplace catalog with 2,000,000 products. The catalog includes a hot-category skew, repeated brands, uneven price bands, inventory variance, active/inactive products, and time-based records so the pagination problem behaves like a realistic feed.

The API serves a category feed that clients browse with a "Load More" interaction. Early pages are usually fine, but deeper requests against the hot category get progressively slower. The challenge is to keep pagination latency stable even as clients keep walking deeper into the feed.

The load test exercises a mix of shallow, medium-depth, and deep browsing against the hot category feed. The starter implementation in `src/index.py` is functionally correct for small result sets, but it degrades badly at depth. Make it scale for deep browsing.

## Run It

Open the repo in the devcontainer, then run:

```bash
make install
PGPASSWORD=password psql -h productsdb -U user -d productsdb -f .nurburgdev/schema.sql
make run
```

Connect to PostgreSQL if needed, password `password`:

```bash
make db
```

Compare first-page and next-page requests:

```bash
make test-compare
```

Schema: `.nurburgdev/schema.sql`  
Code to fix: `src/index.py`, function `get_products`

## The Task

Redesign `GET /products` so later pages remain fast for the hot category feed as clients browse through the catalog.

Keep the API shape:

- optional `page_token` query parameter
- `limit` query parameter between 1 and 100
- response with `products`, `next_page_token`, and `limit`

The API also includes a category filter:

- `category_id` query parameter selects a category feed

You may change the internal meaning of `page_token`. Treat it as an opaque string: clients only pass back the `next_page_token` returned by the previous response.

## Evaluation

| Score | Threshold | Checks |
|---|---:|---|
| `FUNC_TEST` | ≥ 100% | API contract and stable category pagination |
| `LATENCY_95` | < 350ms | Pagination latency under mixed shallow, medium-depth, and deep browsing against a hot category |

The stock implementation should still look fine on early pages. A scalable fix should keep tail latency stable even when some clients walk much deeper into the feed.

## Hint

<details>
<summary>Show hint</summary>

Early pages may look fine, but later pages do more and more database work. Think about whether your pagination strategy makes the database skip rows or seek directly to the next slice.

</details>

[![Try Challenge](https://nurburg.dev/cta/challenge/python/view)](https://nurburg.dev/nurburg-labs:challenge-product-pagination-performance)
