---
title: "PostgreSQL search: Use the tools which you have correctly"
tags: [postgres]
summary: "A support portal search migrated to Postgres full-text search two weeks ago and has been silently broken ever since. Your task is to improve the search quality."
author: Anunay Biswas
authorLink: "https://github.com/anunaybiswas"
authorTitle: "Software Engineer"
intent: "challenge"
draft: false
publishedOn: 2026-05-11
challengeDetails:
  id: 0003
  difficulty: "hard"
  points: 400
  language: "typescript"
---

## Incident Brief

It's 11:40 PM. Your on-call pings you: _"Search on the support portal is returning garbage — old tickets are surfacing, recent ones aren't showing up at all. Customers are furious."_

The support ticket search was migrated two weeks ago from a `ILIKE '%query%'` approach to Postgres full-text search for performance. The migration was declared done. No one touched it since.

## Setup

### Load schema and seed data

```bash
npm run psql -- -f schema.sql
npm run psql -- -f data.sql
```

### Start the service

```bash
npm install && npm run dev
```

### Reset the database

After changing `schema.sql`, drop and reload to pick up trigger changes:

```bash
npm run psql -- -c "DROP TABLE IF EXISTS tickets CASCADE;"
npm run psql -- -f schema.sql
npm run psql -- -f data.sql
```

## Reproducing the issue

```bash
curl "http://localhost:3000/tickets/search?q=crashes"
curl "http://localhost:3000/tickets/search?q=429"
```

There are tickets which mention crash but are not coming in the results and there is a tag "429" but search by tag is not providing any response.

## System Context

A `tickets` table stores support tickets with `title`, `body`, and `tags` (`text[]`) columns. A `search_vector` column of type `tsvector` was added during the migration. There's a GIN index on it. A trigger was supposed to keep `search_vector` updated automatically.

Search queries run `@@` against `search_vector` and return results ordered by `ts_rank`. The search query could be found in `src/index.ts`.

## Search quality bugs

The search has three distinct quality issues. Each manifests independently but they compound — a query can fail for multiple reasons at once.

### Bug 1 — Tag search returns no results

Searching by a tag value returns zero results even when tickets are explicitly tagged with that term. A search for `429` finds nothing despite ticket 8 being tagged `429`. A search for `devops` finds nothing despite two tickets carrying that tag.

### Bug 2 — Inflected words don't match

Searching `crashes` returns no results even when tickets contain `crashing` or `crashed`. The same applies broadly — `running`, `failed`, `connecting` all fail to match their related forms. Tickets that are clearly relevant to the query simply don't appear.

### Bug 3 — Ranking doesn't reflect relevance

When multiple tickets match, the ordering makes no sense. A ticket where the search term appears once deep in the body can rank above a ticket with the term in the title. The result order is effectively arbitrary.

## Your Tasks

Fix the search quality bugs described above.

## Constraints

- No application code changes — fixes must be in the Postgres query in `src/index.ts` if required and DB-side (`schema.sql` only).

## Evaluation

Automated tests will:

- Search `crashes` and assert ticket 2 (contains "crashing") is returned
- Search `429` and assert ticket 8 (tagged `429`) is returned
- Search `devops` and assert tickets 7 and 9 (tagged `devops`) are returned
- Run a query where the term appears in both title and body across different tickets and assert the title match ranks first

<details>
    <summary>Hint</summary>

    Start by inspecting what's actually stored in <code>search_vector</code> for a known ticket:

    ```sql
    SELECT search_vector FROM tickets WHERE id = 2;
    ```

    Then check what token the query produces:

    ```sql
    SELECT websearch_to_tsquery('pg_catalog.english', 'crashes');
    -- 'crash'

    SELECT websearch_to_tsquery('pg_catalog.simple', 'crashes');
    -- 'crashes'
    ```

    If the stored vector was built with <code>simple</code> but the query uses <code>english</code>, they will never match. That mismatch is your starting point for Bug 2.<br><br>

    For Bug 1, <code>tsvector_update_trigger</code> only indexes columns you explicitly list. To include tags, you need to convert the <code>text[]</code> array to a plain string first — look at <a href="https://www.postgresql.org/docs/current/functions-array.html"><code>array_to_string</code></a>.<br><br>

    For Bug 3, <code>ts_rank</code> scores every token equally by default. Use <a href="https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-RANKING"><code>setweight</code></a> to assign weight <code>'A'</code> to title tokens and <code>'B'</code> to tag tokens before combining them into <code>search_vector</code> — body tokens get the default weight <code>'D'</code>.

</details>

---

**Skills exercised:** `tsvector_update_trigger` internals · `setweight()` · `to_tsvector` config mismatches · GIN index behaviour under concurrent writes · online backfill patterns · `ts_rank` vs `ts_rank_cd`
