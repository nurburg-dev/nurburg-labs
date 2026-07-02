CREATE TABLE tickets (
    id            BIGSERIAL PRIMARY KEY,
    title         TEXT        NOT NULL,
    body          TEXT        NOT NULL,
    tags          TEXT[]      NOT NULL DEFAULT '{}',
    status        TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Pre-computed FTS vector. Populated by trigger (see below).
    search_vector TSVECTOR
);

CREATE INDEX idx_tickets_search_vector
    ON tickets USING GIN (search_vector);

CREATE TRIGGER trig_tickets_search_vector
    BEFORE INSERT OR UPDATE OF title, body, tags
    ON tickets
    FOR EACH ROW
EXECUTE FUNCTION tsvector_update_trigger(
    search_vector,
    'pg_catalog.simple',
    title,
    body
);
