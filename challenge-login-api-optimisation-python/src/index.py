import os

import bcrypt
import jwt
from fastapi import FastAPI, HTTPException
from psycopg_pool import ConnectionPool
from pydantic import BaseModel

JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")

app = FastAPI()

pool = ConnectionPool(
    conninfo=(
        f"host={os.environ.get('DB_HOST', 'userdb')} "
        f"port={int(os.environ.get('DB_PORT', 5432))} "
        f"dbname={os.environ.get('DB_NAME', 'userdb')} "
        f"user={os.environ.get('DB_USER', 'user')} "
        f"password={os.environ.get('DB_PASSWORD', 'password')}"
    ),
    min_size=1,
    max_size=20,
)


class LoginRequest(BaseModel):
    email: str
    password: str


@app.get("/healthcheck")
def healthcheck():
    return "OK"


@app.post("/auth/login")
def login(body: LoginRequest):
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, name, password_hash FROM users WHERE email = %s",
                (body.email,),
            )
            row = cur.fetchone()

    if row is None or not bcrypt.checkpw(body.password.encode(), row[3].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = jwt.encode(
        {"userId": row[0], "email": row[1]},
        JWT_SECRET,
        algorithm="HS256",
    )
    return {
        "token": token,
        "user": {"id": row[0], "email": row[1], "name": row[2]},
    }
