CREATE TABLE products (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    category_id     INTEGER      NOT NULL,
    brand           VARCHAR(100) NOT NULL,
    price_cents     INTEGER      NOT NULL,
    inventory_count INTEGER      NOT NULL DEFAULT 0,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP    NOT NULL,
    updated_at      TIMESTAMP    NOT NULL
);

CREATE INDEX idx_products_category_active_id_desc
    ON products (category_id, is_active, id DESC);

INSERT INTO products (
    name,
    category_id,
    brand,
    price_cents,
    inventory_count,
    is_active,
    created_at,
    updated_at
)
SELECT
    'Product-' || LPAD(i::text, 8, '0'),
    CASE
        WHEN i % 100 < 40 THEN 1
        WHEN i % 100 < 60 THEN 2
        WHEN i % 100 < 75 THEN 3
        WHEN i % 100 < 85 THEN 4
        WHEN i % 100 < 93 THEN 5
        ELSE 6 + (i % 15)
    END,
    CASE
        WHEN i % 20 < 5 THEN 'Acme'
        WHEN i % 20 < 9 THEN 'Northwind'
        WHEN i % 20 < 12 THEN 'Summit'
        WHEN i % 20 < 15 THEN 'Bluebird'
        WHEN i % 20 < 17 THEN 'Evergreen'
        ELSE 'Vendor-' || LPAD(((i % 40) + 1)::text, 2, '0')
    END,
    CASE
        WHEN i % 10 < 6 THEN 999 + ((i * 17) % 4000)
        WHEN i % 10 < 9 THEN 4999 + ((i * 29) % 15000)
        ELSE 19999 + ((i * 43) % 80000)
    END,
    CASE
        WHEN i % 25 = 0 THEN 0
        ELSE 1 + ((i * 13) % 250)
    END,
    CASE
        WHEN i % 1000 = 1 THEN FALSE
        ELSE TRUE
    END,
    NOW() - ((2000000 - i) * interval '45 seconds'),
    NOW() - ((2000000 - i) * interval '45 seconds') + (((i * 7) % 72) * interval '1 hour')
FROM generate_series(1, 2000000) AS s(i);
