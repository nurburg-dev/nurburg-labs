CREATE TABLE products (
    id        BIGSERIAL PRIMARY KEY,
    name      VARCHAR(255)   NOT NULL,
    category  VARCHAR(100)   NOT NULL,
    price     DECIMAL(10, 2) NOT NULL,
    stock     INTEGER        NOT NULL DEFAULT 0,
    created_at TIMESTAMP     NOT NULL DEFAULT NOW()
);

INSERT INTO products (name, category, price, stock, created_at)
SELECT
    'Product-' || LPAD(i::text, 8, '0'),
    CASE (i % 6)
        WHEN 0 THEN 'Electronics'
        WHEN 1 THEN 'Clothing'
        WHEN 2 THEN 'Books'
        WHEN 3 THEN 'Home'
        WHEN 4 THEN 'Sports'
        ELSE 'Beauty'
    END,
    ROUND((RANDOM() * 999 + 1)::numeric, 2),
    (RANDOM() * 1000)::integer,
    NOW() - (i * interval '1 second')
FROM generate_series(1, 500000) AS s(i);
