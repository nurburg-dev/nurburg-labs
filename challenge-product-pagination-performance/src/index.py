from fastapi import FastAPI, Query
from typing import Optional
from psycopg_pool import ConnectionPool
import os

app = FastAPI()


pool = ConnectionPool(
    conninfo=(
        f"host={os.environ.get('DB_HOST', 'localhost')} "
        f"port={int(os.environ.get('DB_PORT', 5432))} "
        f"dbname={os.environ.get('DB_NAME', 'productsdb')} "
        f"user={os.environ.get('DB_USER', 'user')} "
        f"password={os.environ.get('DB_PASSWORD', 'password')}"
    ),
    min_size=1,
    max_size=20,
)


@app.get("/healthcheck")
def healthcheck():
    return {"status": "ok"}


@app.get("/products")
def get_products(
    page_token: Optional[str] = Query(None, description="Token for the next page"),
    limit: int = Query(20, ge=1, le=100),
    category_id: int = Query(1, ge=1, le=20),
):
    page = int(page_token) if page_token else 1
    offset = (page - 1) * limit

    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, category_id, brand, price_cents, inventory_count, is_active, created_at, updated_at
                FROM products
                WHERE category_id = %s
                  AND is_active = TRUE
                ORDER BY id DESC
                LIMIT %s OFFSET %s
                """,
                (category_id, limit, offset),
            )
            rows = cur.fetchall()

    products = [
        {
            "id": r[0],
            "name": r[1],
            "category_id": r[2],
            "brand": r[3],
            "price_cents": r[4],
            "inventory_count": r[5],
            "is_active": r[6],
            "created_at": r[7].isoformat(),
            "updated_at": r[8].isoformat(),
        }
        for r in rows
    ]
    next_page_token = str(page + 1) if rows else None

    return {"products": products, "next_page_token": next_page_token, "limit": limit}
