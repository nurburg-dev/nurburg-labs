CREATE TABLE IF NOT EXISTS flights (
    flight_id           VARCHAR(36) PRIMARY KEY,
    flight_number       VARCHAR(16) NOT NULL,
    flight_date         DATE NOT NULL,
    from_airport        VARCHAR(10) NOT NULL,
    to_airport          VARCHAR(10) NOT NULL,
    seat_count          INT NOT NULL,
    available_seat_count  INT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO flights (flight_id, flight_number, flight_date, from_airport, to_airport, seat_count, available_seat_count)
VALUES
    ('a1f00000-0000-0000-0000-000000000001', 'A1-101', '2026-04-10', 'IXD', 'BLR', 100, 100),
    ('a1f00000-0000-0000-0000-000000000002', 'A1-102', '2026-04-11', 'IXD', 'BLR', 100, 100)
ON CONFLICT (flight_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS flight_bookings (
    id            VARCHAR(36) PRIMARY KEY,
    booking_id    VARCHAR(36) NOT NULL,
    flight_id     VARCHAR(36) NOT NULL REFERENCES flights(flight_id),
    status        VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    booking_count INT NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
