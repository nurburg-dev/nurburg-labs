from fastapi import FastAPI, Query
from typing import Optional
import psycopg2
import os

app = FastAPI()


def get_db():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", 5432)),
        dbname=os.environ.get("DB_NAME", "productsdb"),
        user=os.environ.get("DB_USER", "user"),
        password=os.environ.get("DB_PASSWORD", "password"),
    )


@app.get("/healthcheck")
def healthcheck():
    return {"status": "ok"}


@app.get("/products")
def get_products(
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100),
):
    # BUG: cursor is decoded as a page number and translated to OFFSET.
    # PostgreSQL must scan and discard (page-1)*limit rows on every request.
    # Deep pages require scanning hundreds of thousands of rows, making
    # response time grow linearly with depth.
    page = int(cursor) if cursor else 1
    offset = (page - 1) * limit

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, category, price, stock, created_at
                FROM products
                ORDER BY id DESC
                LIMIT %s OFFSET %s
                """,
                (limit, offset),
            )
            rows = cur.fetchall()

        products = [
            {
                "id": r[0],
                "name": r[1],
                "category": r[2],
                "price": float(r[3]),
                "stock": r[4],
                "created_at": r[5].isoformat(),
            }
            for r in rows
        ]
        next_cursor = str(page + 1) if rows else None
        return {"products": products, "next_cursor": next_cursor, "limit": limit}
    finally:
        conn.close()
