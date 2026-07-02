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
  id: 0003
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

After changing `schema.sql`, drop and reload to pick up column/trigger changes:

```bash
PGPASSWORD=password psql -h ticketsdb -U user -d ticketsdb -c "DROP TABLE IF EXISTS tickets CASCADE;"
PGPASSWORD=password psql -h ticketsdb -U user -d ticketsdb -f schema.sql
PGPASSWORD=password psql -h ticketsdb -U user -d ticketsdb -f data.sql
```

## How search works today

A `tickets` table stores support tickets with `title`, `body`, and `tags` (`text[]`) columns. A `search_vector` column was added during the migration as a **generated column**, backed by a **GIN (Generalized Inverted Index)** for fast lookups:

```sql
search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('pg_catalog.simple', title || ' ' || body)
) STORED
```

```sql
CREATE INDEX idx_tickets_search_vector ON tickets USING GIN (search_vector);
```

A GIN index flips the usual storage direction: instead of mapping row → contents like a B-tree does for a column value, it maps each lexeme (word) in `search_vector` to the list of rows that contain it. That's what makes `search_vector @@ websearch_to_tsquery(...)` fast at scale - Postgres looks the query word up directly in the index and gets matching row pointers back, instead of scanning every row's text.

Concretely, GIN stores two layers: an ordered B-tree-like structure over the distinct _keys_ (here, the distinct lexemes across every row's `search_vector`), and for each key a **posting list** - the set of row pointers where that lexeme appears. `@@` decomposes the query into lexemes, looks each one up in the key tree (`O(log n)` in the number of distinct lexemes, not rows), and intersects/unions the resulting posting lists according to the query's `AND`/`OR` structure. This is why GIN scales so much better than `ILIKE '%query%'`, which has no index to consult and must scan and pattern-match every row's raw text.

The tradeoff is write cost: a GIN entry touches one posting list per distinct lexeme in the row, so inserting a row with many unique words means many small index updates, and updating a row means removing and re-adding entries across potentially many lists. Postgres mitigates this with a `GIN pending list` that buffers new entries and merges them into the main structure in batches - fine for this challenge's write volume, but worth knowing about for high-throughput ingestion. Read-heavy workloads like ticket search, where writes are relatively rare and lookups need to be fast, are exactly what GIN is built for. (Postgres also offers **GiST** indexes for full-text search - faster to update, but lossy and slower to query - a tradeoff that doesn't fit this use case.)

`search_vector` is declared `GENERATED ALWAYS AS (...) STORED` — Postgres recomputes it automatically from `title` and `body` on every insert or update, as part of the row write itself. There's no separate function to keep in sync with the table's columns; the expression lives directly in the column definition, and Postgres guarantees the stored value can never drift from what the expression would currently produce. (Generated column expressions must be immutable - no `now()`, no subqueries, no reaching into other tables - which is why this pattern only works for deriving a column from that same row's own data, but that's exactly what indexing `title` and `body` needs.)

The `/tickets/search` endpoint in `src/index.py` matches against that vector and orders by recency:

```sql
SELECT id, title, tags, status, created_at
FROM tickets
WHERE search_vector @@ websearch_to_tsquery('pg_catalog.simple', $1)
ORDER BY updated_at DESC
```

On paper this looks like a textbook full-text search setup: precomputed vector, GIN index, generated column. It's also wrong in three separate ways.

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

> **Hint:** look at the generated expression above - it only reads `title` and `body`. `tags` isn't referenced at all. It's a `text[]`, not `text`, so you can't concatenate it into the expression directly with `||`; see [`array_to_string`](https://www.postgresql.org/docs/current/functions-array.html) for a way to fold it into a string first.

### Bug 2 - Inflected words don't match

Searching `crashes` returns no results even when tickets contain `crashing` or `crashed`. The same applies broadly - `running`, `failed`, `connecting` all fail to match their related forms.

> **Hint:** compare what each text search configuration does with the same word:
>
> ```sql
> SELECT websearch_to_tsquery('pg_catalog.english', 'crashes'); -- 'crash'
> SELECT websearch_to_tsquery('pg_catalog.simple', 'crashes');  -- 'crashes'
> ```
>
> The generated expression builds `search_vector` with `pg_catalog.simple`, which stores words as-is with no stemming. If the query side and the generated column's expression use different configurations, they will never agree on what a word reduces to.

### Bug 3 - Ranking doesn't reflect relevance

When multiple tickets match, the ordering makes no sense. A ticket where the search term appears once deep in the body can rank above a ticket with the term in the title.

> **Hint:** the current query doesn't rank by relevance at all - it orders by `updated_at`. Even a relevance-based `ORDER BY ts_rank(...)` won't help here, because every token in `search_vector` carries equal weight by default. Use [`setweight`](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-RANKING) to mark title tokens `'A'`, tag tokens `'B'`, and let body tokens fall back to the default `'D'` before combining them into `search_vector`.

#### Ranking in PostgreSQL

Postgres doesn't rank matches for you automatically - `search_vector @@ query` only tells you whether a row matches, not how well. Ranking is a separate, explicit step built from two pieces:

**1. `ts_rank` / `ts_rank_cd`** score a `tsvector` against a `tsquery`:

```sql
SELECT id, ts_rank(search_vector, websearch_to_tsquery('pg_catalog.simple', 'crashes')) AS rank
FROM tickets
ORDER BY rank DESC;
```

`ts_rank` weighs matches by lexeme frequency; `ts_rank_cd` ("cover density") also factors in how close matching terms are to each other in the text. Either works here - the missing ingredient isn't the ranking function, it's that every lexeme in `search_vector` currently looks equally important.

**2. `setweight`** labels the lexemes coming from each source column with a weight class - `'A'` (highest) through `'D'` (lowest, the default) - before they're merged:

```sql
setweight(to_tsvector('pg_catalog.simple', title), 'A') ||
setweight(to_tsvector('pg_catalog.simple', array_to_string(tags, ' ')), 'B') ||
setweight(to_tsvector('pg_catalog.simple', body), 'D')
```

`ts_rank` then uses those labels to weight its score - by default `{D, C, B, A}` contribute `{0.1, 0.2, 0.4, 1.0}` respectively - so a title hit outranks a body hit even if the body mentions the term more often.

The current generated expression - `to_tsvector('pg_catalog.simple', title || ' ' || body)` - can't express this: it's a single call over concatenated text, so every lexeme ends up at the same default weight. The obvious fix is to rewrite the `GENERATED ALWAYS AS (...)` expression to the `setweight(...) || setweight(...) || ...` form above — but try that and Postgres rejects the column outright:

```
ERROR: generation expression is not immutable
```

**Why it breaks:** `GENERATED ALWAYS AS` columns are held to a stricter standard than indexes — the whole expression must be provably `IMMUTABLE`. Every individual function here (`to_tsvector` with an explicit config, `setweight`, `||`) is immutable on its own, but combining several `setweight()`-wrapped `to_tsvector()` calls together is enough to trip that check. There's no expression-only workaround.

**The fix:** drop `GENERATED ALWAYS AS (...) STORED` entirely and maintain `search_vector` with a trigger instead. Trigger functions aren't held to the immutability restriction, so they can freely combine `setweight()` across `title`, `tags`, and `body`:

```sql
search_vector TSVECTOR

-- ...

CREATE FUNCTION tickets_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('pg_catalog.english', NEW.title), 'A') ||
        setweight(to_tsvector('pg_catalog.english', array_to_string(NEW.tags, ' ')), 'B') ||
        setweight(to_tsvector('pg_catalog.english', NEW.body), 'D');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_tickets_search_vector
    BEFORE INSERT OR UPDATE OF title, body, tags
    ON tickets
    FOR EACH ROW
EXECUTE FUNCTION tickets_search_vector_update();
```

This single change also folds Bug 1's fix in for free - `tags` is now part of the same weighted expression instead of a separate patch.

## Your Tasks

Fix the search quality bugs described above.

## Constraints

- No application code changes - fixes must be in the Postgres query in `src/index.py` if required and DB-side (`schema.sql` only).

## Evaluation

Automated tests will:

- Search `crashes` and assert ticket 2 (contains "crashing") is returned
- Search `429` and assert ticket 8 (tagged `429`) is returned
- Search `devops` and assert tickets 7 and 9 (tagged `devops`) are returned
- Run a query where the term appears in both title and body across different tickets and assert the title match ranks first

---

**Skills exercised:** `GENERATED ALWAYS AS (...) STORED` immutability limits · migrating a generated column to a trigger-maintained one · `setweight()` · `to_tsvector` config mismatches · GIN index behaviour under concurrent writes · online backfill patterns · `ts_rank` vs `ts_rank_cd`
