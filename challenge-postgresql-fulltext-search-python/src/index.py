import os
from typing import Optional

import asyncpg
from fastapi import FastAPI, HTTPException, Query

app = FastAPI()

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "ticketsdb"),
    "port": int(os.environ.get("DB_PORT", 5432)),
    "user": os.environ.get("DB_USER", "user"),
    "password": os.environ.get("DB_PASSWORD", "password"),
    "database": os.environ.get("DB_NAME", "ticketsdb"),
}

pool: Optional[asyncpg.Pool] = None

VALID_STATUSES = {"open", "in_progress", "resolved", "closed"}


@app.on_event("startup")
async def startup():
    global pool
    pool = await asyncpg.create_pool(**DB_CONFIG)


@app.on_event("shutdown")
async def shutdown():
    if pool:
        await pool.close()


@app.get("/healthcheck")
async def healthcheck():
    return "OK"


# BUGS observed:
# 1. Searching "crashes" returns no results even when tickets mention "crash" or "crashed"
# 2. A ticket where the query appears only in the body ranks the same as one where it's in the title
# 3. Searching by a tag value (e.g. "redis") returns no results unless the word also appears in the text
@app.get("/tickets/search")
async def search_tickets(
    q: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, gt=0),
    limit: int = Query(20, gt=0, le=100),
):
    if not q:
        raise HTTPException(status_code=400, detail="query param `q` is required")
    if status is not None and status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="invalid status")

    offset = (page - 1) * limit

    status_clause = "AND status = $4" if status else ""
    query = f"""
        SELECT id, title, tags, status, created_at, COUNT(*) OVER () AS total_count
        FROM tickets
        WHERE search_vector @@ websearch_to_tsquery('pg_catalog.simple', $1)
          {status_clause}
        ORDER BY updated_at DESC
        LIMIT $2 OFFSET $3
    """
    params = (q, limit, offset, status) if status else (q, limit, offset)

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
    except Exception:
        raise HTTPException(status_code=500, detail="search unavailable")

    data = []
    total = 0
    for row in rows:
        record = dict(row)
        total = record.pop("total_count")
        data.append(record)

    return {
        "data": data,
        "meta": {"total": total, "page": page, "limit": limit},
    }
