CREATE TABLE tickets (
    id            BIGSERIAL PRIMARY KEY,
    title         TEXT        NOT NULL,
    body          TEXT        NOT NULL,
    tags          TEXT[]      NOT NULL DEFAULT '{}',
    status        TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Pre-computed FTS vector, recomputed automatically as a generated column.
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('pg_catalog.simple', title || ' ' || body)
    ) STORED
);

CREATE INDEX idx_tickets_search_vector
    ON tickets USING GIN (search_vector);
