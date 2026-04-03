CREATE TABLE orders (
    order_id     TEXT PRIMARY KEY,
    amount       NUMERIC(12, 2)  NOT NULL,
	customer_id  TEXT NOT NULL,
    currency     CHAR(3)         NOT NULL DEFAULT 'USD',
    status       TEXT            NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ     NOT NULL DEFAULT now()
);
