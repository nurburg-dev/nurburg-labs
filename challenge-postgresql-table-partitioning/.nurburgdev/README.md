---
title: "Analytics Dashboard Meltdown"
tags:
    - scalability
    - postgres
summary: "Your transaction log queries are grinding to a halt as the table grows. Implement PostgreSQL table partitioning to bring date-range queries back under 1 second."
author: Anunay Biswas
authorTitle: founder, nurburg.dev
authorLink: https://www.linkedin.com/in/anunay-biswas-26206539/
publishedOn: 2026-05-11
intent: challenge
draft: false
challengeDetails:
  id: 0005
  difficulty: "medium"
  points: 300
  language: "typescript"
---

## The Incident

Nobody noticed when it started. A year ago, a date-range query on `transaction_logs` came back in under 100ms. Then 300ms. Then 2 seconds. Each quarter the dashboards loaded a little slower, and each quarter the team shrugged it off as the database being busy.

Now the table has grown past 50 million rows and the weekly finance report times out before it loads.

The root cause is how PostgreSQL stores table data on disk. Every table is broken into 1GB segment files. When `transaction_logs` was small, a query for January's data touched a handful of files. As the table grew, January's rows got scattered across hundreds of segment files alongside data from every other month — so fetching one month now means reading the whole thing.

Disk I/O is a finite resource. A hard disk can only move its read head so fast; an SSD can only service so many concurrent read requests. Every unnecessary file read competes for that budget. When a query forces PostgreSQL to scan 200 segment files to find data that could have fit in 2, it burns through the I/O budget of the entire database server — starving every other query running at the same time. That is why the latency decay was felt across the whole system, not just in the finance dashboard.

Wouldn't it be better if all of January's data lived together in its own smaller set of files? Then a query for that month would only need to touch those files, and the rest of the table would never be read at all.

---

## Setup

Reset the schema, load dev data, and start the server:

```bash
npm install        # install dependencies
npm run db:reset   # drop and recreate transaction_logs from schema.sql
npm run db:seed    # stream CSV into the table
npm run dev        # start the API on port 3000
```

To start fresh at any point, run `db:reset` and `db:seed` again. Connect to the database directly with:

```bash
npm run psql
```

Check the table size and row count:

```sql
SELECT
  pg_size_pretty(pg_total_relation_size('transaction_logs')) AS total_size,
  COUNT(*) AS row_count
FROM transaction_logs;
```

---

## See It Break

Try the API directly:

```bash
curl "http://localhost:3000/transactions?start_date=2023-01-01&end_date=2023-01-31"
```

Note the `query_time_ms` in the response. Under load, this is what's killing the dashboard.

---

## Your Task

PostgreSQL has a built-in mechanism to organise a table's data into smaller, time-bounded physical chunks so that queries only read what they actually need.

Read through the [Table Partitioning documentation](https://www.postgresql.org/docs/current/ddl-partitioning.html) and apply it to `transaction_logs`.

The API must continue to work without changes. Scoring is based on latency and error rate under load.

---

## Constraints

- Do not change the API response format
- The application queries the table as `transaction_logs` — that name must remain queryable
- Indexes must exist on the partitioned data for `transaction_date`, `user_id`, and `transaction_type`

---

## Hint

<details>
<summary>Show hint</summary>

The queries filter by `transaction_date`, so that is the natural column to partition on. Look at the **range partitioning** section of the docs — it lets you declare that values between two dates belong to a specific partition.

PostgreSQL cannot add partitioning to an existing table after the fact, so you will need to rethink how the table is defined from the start.

</details>
