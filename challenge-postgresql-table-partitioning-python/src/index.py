import asyncio
import os
import re
import time
from datetime import date
from typing import Optional

import asyncpg
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

app = FastAPI()

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "postgresdb"),
    "port": int(os.environ.get("DB_PORT", 5432)),
    "user": os.environ.get("DB_USER", "user"),
    "password": os.environ.get("DB_PASSWORD", "password"),
    "database": os.environ.get("DB_NAME", "transactiondb"),
}

pool: Optional[asyncpg.Pool] = None

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DIGITS_RE = re.compile(r"^\d+$")
TRANSACTION_TYPES = {"purchase", "refund", "transfer"}


@app.on_event("startup")
async def startup():
    global pool
    pool = await asyncpg.create_pool(
        **DB_CONFIG, min_size=1, max_size=10, command_timeout=2
    )


@app.on_event("shutdown")
async def shutdown():
    if pool:
        await pool.close()


@app.get("/healthcheck")
async def healthcheck():
    try:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "error"})


@app.get("/transactions")
async def get_transactions(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    limit: Optional[str] = Query(None),
):
    errors = []
    if not start_date or not DATE_RE.match(start_date):
        errors.append("start_date must be YYYY-MM-DD")
    if not end_date or not DATE_RE.match(end_date):
        errors.append("end_date must be YYYY-MM-DD")
    if user_id is not None and not DIGITS_RE.match(user_id):
        errors.append("user_id must be an integer")
    if transaction_type is not None and transaction_type not in TRANSACTION_TYPES:
        errors.append("transaction_type must be one of purchase, refund, transfer")
    if limit is not None and not DIGITS_RE.match(limit):
        errors.append("limit must be an integer")

    if errors:
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid query parameters", "details": errors},
        )

    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid query parameters", "details": ["invalid date"]},
        )

    limit_val = int(limit) if limit is not None else 100

    conditions = ["transaction_date >= $1", "transaction_date <= $2"]
    params: list = [start, end]
    param_idx = 3

    if user_id is not None:
        conditions.append(f"user_id = ${param_idx}")
        params.append(int(user_id))
        param_idx += 1
    if transaction_type is not None:
        conditions.append(f"transaction_type = ${param_idx}")
        params.append(transaction_type)
        param_idx += 1

    where_clause = " AND ".join(conditions)
    started_at = time.monotonic()

    transactions_query = f"""
        SELECT id, user_id, transaction_type, amount, currency, transaction_date, status, payment_method
        FROM transaction_logs
        WHERE {where_clause}
        ORDER BY transaction_date DESC
        LIMIT ${param_idx}
    """
    stats_query = f"""
        SELECT
            COUNT(*) AS total_count,
            COALESCE(SUM(amount), 0) AS total_amount,
            COALESCE(AVG(amount), 0) AS avg_amount,
            COUNT(DISTINCT user_id) AS unique_users
        FROM transaction_logs
        WHERE {where_clause}
    """

    try:
        transactions_rows, stats_row = await asyncio.gather(
            pool.fetch(transactions_query, *params, limit_val),
            pool.fetchrow(stats_query, *params),
        )
    except Exception:
        return JSONResponse(
            status_code=500, content={"error": "Internal server error"}
        )

    query_time_ms = int((time.monotonic() - started_at) * 1000)

    return {
        "transactions": [dict(row) for row in transactions_rows],
        "stats": dict(stats_row),
        "meta": {
            "query_time_ms": query_time_ms,
            "count": len(transactions_rows),
        },
    }
