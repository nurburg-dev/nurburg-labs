CREATE TABLE transaction_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    transaction_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    merchant_id INTEGER,
    payment_method VARCHAR(30),
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    description TEXT,
    metadata JSONB
);

CREATE INDEX idx_transaction_logs_user_id ON transaction_logs(user_id);
CREATE INDEX idx_transaction_logs_date ON transaction_logs(transaction_date);
CREATE INDEX idx_transaction_logs_type ON transaction_logs(transaction_type);
