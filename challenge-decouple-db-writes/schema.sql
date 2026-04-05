CREATE TABLE click_events (
    id          BIGSERIAL PRIMARY KEY,
    session_id  UUID        NOT NULL,
    element_id  VARCHAR(255) NOT NULL,
    page_url    TEXT        NOT NULL,
    x           INT         NOT NULL,
    y           INT         NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


