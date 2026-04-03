CREATE TABLE IF NOT EXISTS bookings (
    booking_id    VARCHAR(36) PRIMARY KEY,
    customer_id   VARCHAR(36) NOT NULL,
    status        VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    total_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
