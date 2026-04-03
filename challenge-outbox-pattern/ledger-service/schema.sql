CREATE TABLE ledger_entries (
    entry_id    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    order_id    TEXT            NOT NULL,
    customer_id TEXT            NOT NULL,
    amount      NUMERIC(12, 2)  NOT NULL,
    currency    CHAR(3)         NOT NULL DEFAULT 'USD',
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);
