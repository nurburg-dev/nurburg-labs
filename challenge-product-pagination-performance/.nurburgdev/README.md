---
title: "Speed Up Deep Product Catalog Pagination"
author: "nurburg-dev"
authorLink: "https://github.com/nurburg-dev"
authorTitle: "Software Engineer"
summary: "A product catalog API is fast on early pages but slows to seconds when users browse deep into the results. Redesign pagination so deep pages stay fast."
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

Your team runs a fashion marketplace catalog with 500,000 products. The frontend uses a "Load More" button. Early pages are fast, but users who scroll deep into the catalog wait several seconds per page and database CPU spikes.

The implementation in `src/index.py` is simple and correct for small result sets. Make it scale for deep catalog browsing.

## Run It

```bash
make install
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

Redesign `GET /products` so later pages remain fast as users browse through the catalog.

Keep the API shape:

- optional `page_token` query parameter
- `limit` query parameter between 1 and 100
- response with `products`, `next_page_token`, and `limit`

You may change the internal meaning of `page_token`. Treat it as a simple opaque string: clients only pass back the `next_page_token` returned by the previous response.

## Evaluation

| Score | Threshold | Checks |
|---|---:|---|
| `FUNC_TEST` | ≥ 100% | API contract and non-empty results |
| `ERR_RATE` | < 5% | No crashes or 5xx errors under load |
| `LATENCY_95` | < 200ms | Pagination latency under load |

The stock implementation can take seconds for deep browsing. A scalable fix should stay well under the latency threshold.

[![Try Challenge](https://nurburg.dev/cta/challenge/python/view)](https://nurburg.dev/nurburg-labs:challenge-product-pagination-performance)
