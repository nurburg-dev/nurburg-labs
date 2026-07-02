---
title: "PostgreSQL search: Use the tools which you have correctly"
tags: [postgres]
summary: "A support portal search migrated to Postgres full-text search two weeks ago and has been silently broken ever since. Your task is to improve the search quality."
author: Anunay Biswas
authorLink: "https://github.com/anunaybiswas"
authorTitle: "Software Engineer"
intent: "challenge"
draft: false
publishedOn: 2026-07-02
challengeDetails:
  difficulty: "hard"
  points: 400
  language: "python"
---

## Incident Brief

It's 11:40 PM. Your on-call pings you: _"Search on the support portal is returning garbage - old tickets are surfacing, recent ones aren't showing up at all. Customers are furious."_

The support ticket search was migrated two weeks ago from an `ILIKE '%query%'` approach to Postgres full-text search for performance. The migration was declared done. No one touched it since.

## Setup

### Install dependencies

```bash
uv sync
```

### Load schema and seed data

```bash
PGPASSWORD=password psql -h ticketsdb -U user -d ticketsdb -f schema.sql
PGPASSWORD=password psql -h ticketsdb -U user -d ticketsdb -f data.sql
```

### Start the service

```bash
uv run uvicorn src.index:app --host 0.0.0.0 --port 8000 --reload
```

### Reset the database

After changing `schema.sql`, drop and reload to pick up trigger changes:

```bash
PGPASSWORD=password psql -h ticketsdb -U user -d ticketsdb -c "DROP TABLE IF EXISTS tickets CASCADE;"
PGPASSWORD=password psql -h ticketsdb -U user -d ticketsdb -f schema.sql
PGPASSWORD=password psql -h ticketsdb -U user -d ticketsdb -f data.sql
```

## How search works today

A `tickets` table stores support tickets with `title`, `body`, and `tags` (`text[]`) columns. A `search_vector tsvector` column was added during the migration, backed by a **GIN (Generalized Inverted Index)** for fast lookups:

```sql
CREATE INDEX idx_tickets_search_vector ON tickets USING GIN (search_vector);
```

A GIN index flips the usual storage direction: instead of mapping row → contents like a B-tree does for a column value, it maps each lexeme (word) in `search_vector` to the list of rows that contain it. That's what makes `search_vector @@ websearch_to_tsquery(...)` fast at scale - Postgres looks the query word up directly in the index and gets matching row pointers back, instead of scanning every row's text.

A **trigger** keeps `search_vector` populated on every insert/update, using Postgres's built-in `tsvector_update_trigger`:

```sql
CREATE TRIGGER trig_tickets_search_vector
    BEFORE INSERT OR UPDATE OF title, body, tags
    ON tickets
    FOR EACH ROW
EXECUTE FUNCTION tsvector_update_trigger(
    search_vector, 'pg_catalog.simple', title, body
);
```

Triggers are functions Postgres runs automatically in response to table writes. This one fires `BEFORE INSERT OR UPDATE OF title, body, tags` — so it re-runs whenever any of those three columns change — and recomputes `search_vector` from the columns it's told to index, keeping the search index in sync without the application ever having to remember to update it.

The `/tickets/search` endpoint in `src/index.py` matches against that vector and orders by recency:

```sql
SELECT id, title, tags, status, created_at
FROM tickets
WHERE search_vector @@ websearch_to_tsquery('pg_catalog.simple', $1)
ORDER BY updated_at DESC
```

On paper this looks like a textbook full-text search setup: precomputed vector, GIN index, trigger-maintained. It's also wrong in three separate ways.

## Reproducing the issue

```bash
curl "http://localhost:8000/tickets/search?q=crashes"
curl "http://localhost:8000/tickets/search?q=429"
```

Tickets that clearly mention crashing don't come back for `crashes`, and `429` - a tag on ticket 8 - returns nothing at all.

## The bugs

Each bug is independent, but a single query can trip more than one at once.

### Bug 1 - Tag search returns no results

Searching by a tag value returns zero results even when tickets are explicitly tagged with that term. `429` finds nothing despite ticket 8 being tagged `429`. `devops` finds nothing despite two tickets carrying that tag.

> **Hint:** look at the trigger definition above - `tsvector_update_trigger` only indexes the columns you explicitly pass it. `tags` isn't one of them. It's a `text[]`, not `text`, so you can't hand it to the trigger directly; see [`array_to_string`](https://www.postgresql.org/docs/current/functions-array.html) for a way to convert it first.

### Bug 2 - Inflected words don't match

Searching `crashes` returns no results even when tickets contain `crashing` or `crashed`. The same applies broadly - `running`, `failed`, `connecting` all fail to match their related forms.

> **Hint:** compare what each text search configuration does with the same word:
>
> ```sql
> SELECT websearch_to_tsquery('pg_catalog.english', 'crashes'); -- 'crash'
> SELECT websearch_to_tsquery('pg_catalog.simple', 'crashes');  -- 'crashes'
> ```
>
> The trigger builds `search_vector` with `pg_catalog.simple`, which stores words as-is with no stemming. If the query side and the storage side use different configurations, they will never agree on what a word reduces to.

### Bug 3 - Ranking doesn't reflect relevance

When multiple tickets match, the ordering makes no sense. A ticket where the search term appears once deep in the body can rank above a ticket with the term in the title.

> **Hint:** the current query doesn't rank by relevance at all - it orders by `updated_at`. Even a relevance-based `ORDER BY ts_rank(...)` won't help here, because every token in `search_vector` carries equal weight by default. Use [`setweight`](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-RANKING) to mark title tokens `'A'`, tag tokens `'B'`, and let body tokens fall back to the default `'D'` before combining them into `search_vector`.

## Your Task

Fix the search quality bugs described above.

## Constraints

- No application code changes - fixes must be in the Postgres query in `src/index.py` if required and DB-side (`schema.sql` only).

## Evaluation

Automated tests will:

- Search `crashes` and assert ticket 2 (contains "crashing") is returned
- Search `429` and assert ticket 8 (tagged `429`) is returned
- Search `devops` and assert tickets 7 and 9 (tagged `devops`) are returned
- Run a query where the term appears in both title and body across different tickets and assert the title match ranks first
