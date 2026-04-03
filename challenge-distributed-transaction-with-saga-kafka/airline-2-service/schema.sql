CREATE TABLE IF NOT EXISTS flights (
    flight_id           VARCHAR(36) PRIMARY KEY,
    flight_number       VARCHAR(16) NOT NULL,
    flight_date         DATE NOT NULL,
    from_airport        VARCHAR(10) NOT NULL,
    to_airport          VARCHAR(10) NOT NULL,
    seat_count          INT NOT NULL,
    available_seat_count  INT NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO flights (flight_id, flight_number, flight_date, from_airport, to_airport, seat_count, available_seat_count)
VALUES
    ('a2f00000-0000-0000-0000-000000000001', 'A2-201', '2026-04-10', 'BLR', 'IXE', 100, 100),
    ('a2f00000-0000-0000-0000-000000000002', 'A2-202', '2026-04-11', 'BLR', 'IXE', 100, 100);

CREATE TABLE IF NOT EXISTS flight_bookings (
    id            VARCHAR(36) PRIMARY KEY,
    booking_id    VARCHAR(36) NOT NULL,
    flight_id     VARCHAR(36) NOT NULL,
    status        VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    booking_count INT NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (flight_id) REFERENCES flights(flight_id)
);
