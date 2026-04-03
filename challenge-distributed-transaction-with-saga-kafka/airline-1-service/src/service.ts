import { PgPool } from "nurburg-libs";
import {
    FlightBooking,
    Airline1FlightBookingBlockRequest,
    Airline1FlightBookingConfirmationRequest,
    Airline1FlightBookingCancelRequest,
} from "./models";

export class Airline1Service {
    constructor(private readonly pool: PgPool) {}

    async blockFlightBooking(req: Airline1FlightBookingBlockRequest): Promise<FlightBooking> {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");

            // idempotency: return existing booking if already created for this bookingId
            const existing = await client.query(
                `SELECT * FROM flight_bookings WHERE booking_id = $1 LIMIT 1`,
                [req.bookingId]
            );
            if (existing.rowCount! > 0) {
                await client.query("COMMIT");
                return existing.rows[0] as FlightBooking;
            }

            const flightResult = await client.query(
                `SELECT flight_id FROM flights
                 WHERE flight_date = $1 AND available_seat_count >= $2
                 LIMIT 1
                 FOR UPDATE`,
                [req.flightDate, req.seatCount]
            );

            if (flightResult.rowCount === 0) {
                throw new Error("No available flights for the requested date and seat count");
            }

            const flightId = flightResult.rows[0].flight_id;

            await client.query(
                `UPDATE flights SET available_seat_count = available_seat_count - $1 WHERE flight_id = $2`,
                [req.seatCount, flightId]
            );

            const bookingResult = await client.query(
                `INSERT INTO flight_bookings (id, booking_id, flight_id, status, booking_count)
                 VALUES (gen_random_uuid(), $1, $2, 'BLOCKED', $3)
                 RETURNING *`,
                [req.bookingId, flightId, req.seatCount]
            );

            await client.query("COMMIT");

            return bookingResult.rows[0] as FlightBooking;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }

    async confirmFlightBooking(req: Airline1FlightBookingConfirmationRequest): Promise<FlightBooking> {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");

            const existing = await client.query(
                `SELECT * FROM flight_bookings WHERE booking_id = $1 LIMIT 1`,
                [req.bookingId]
            );

            if (existing.rowCount === 0) {
                throw new Error(`Flight booking for bookingId ${req.bookingId} not found`);
            }

            const booking = existing.rows[0] as FlightBooking;

            // idempotency: already confirmed
            if (booking.status === 'CONFIRMED') {
                await client.query("COMMIT");
                return booking;
            }

            if (booking.status !== 'BLOCKED') {
                throw new Error(`Flight booking is in ${booking.status} state, cannot confirm`);
            }

            const result = await client.query(
                `UPDATE flight_bookings SET status = 'CONFIRMED', updated_at = NOW()
                 WHERE booking_id = $1
                 RETURNING *`,
                [req.bookingId]
            );

            await client.query("COMMIT");

            return result.rows[0] as FlightBooking;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }

    async getConfirmedBookings(): Promise<FlightBooking[]> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                `SELECT * FROM flight_bookings WHERE status = 'CONFIRMED' ORDER BY created_at DESC`
            );
            return result.rows as FlightBooking[];
        } finally {
            client.release();
        }
    }

    async cancelFlightBooking(req: Airline1FlightBookingCancelRequest): Promise<FlightBooking> {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");

            const existing = await client.query(
                `SELECT * FROM flight_bookings WHERE booking_id = $1 LIMIT 1`,
                [req.bookingId]
            );

            if (existing.rowCount === 0) {
                throw new Error(`Flight booking for bookingId ${req.bookingId} not found`);
            }

            const booking = existing.rows[0] as FlightBooking;

            // idempotency: already cancelled
            if (booking.status === 'CANCELLED') {
                await client.query("COMMIT");
                return booking;
            }

            if (booking.status !== 'BLOCKED') {
                throw new Error(`Flight booking is in ${booking.status} state, cannot cancel`);
            }

            const result = await client.query(
                `UPDATE flight_bookings SET status = 'CANCELLED', updated_at = NOW()
                 WHERE booking_id = $1
                 RETURNING *`,
                [req.bookingId]
            );

            await client.query(
                `UPDATE flights SET available_seat_count = available_seat_count + $1 WHERE flight_id = $2`,
                [booking.booking_count, booking.flight_id]
            );

            await client.query("COMMIT");

            return result.rows[0] as FlightBooking;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }
}
