import { MySQLPool } from "nurburg-libs";
import { RowDataPacket } from "mysql2/promise";
import {
    FlightBooking,
    Airline2FlightBookingBlockRequest,
    Airline2FlightBookingConfirmationRequest,
    Airline2FlightBookingCancelRequest,
} from "./models";

export class Airline2Service {
    constructor(private readonly pool: MySQLPool) {}

    async blockFlightBooking(req: Airline2FlightBookingBlockRequest): Promise<FlightBooking> {
        const client = await this.pool.getConnection();
        try {
            await client.query("BEGIN");

            // idempotency: return existing booking if already created for this bookingId
            const [existing] = await client.query<RowDataPacket[]>(
                `SELECT * FROM flight_bookings WHERE booking_id = ? LIMIT 1`,
                [req.bookingId]
            );
            if (existing.length > 0) {
                await client.query("COMMIT");
                return existing[0] as FlightBooking;
            }

            const [flights] = await client.query<RowDataPacket[]>(
                `SELECT flight_id FROM flights
                 WHERE flight_date = ? AND available_seat_count >= ?
                 LIMIT 1
                 FOR UPDATE`,
                [req.flightDate, req.seatCount]
            );

            if (flights.length === 0) {
                throw new Error("No available flights for the requested date and seat count");
            }

            const flightId = flights[0].flight_id;

            await client.query(
                `UPDATE flights SET available_seat_count = available_seat_count - ? WHERE flight_id = ?`,
                [req.seatCount, flightId]
            );

            const [uuidRows] = await client.query<RowDataPacket[]>(`SELECT UUID() AS id`);
            const newId = uuidRows[0].id;

            await client.query(
                `INSERT INTO flight_bookings (id, booking_id, flight_id, status, booking_count)
                 VALUES (?, ?, ?, 'BLOCKED', ?)`,
                [newId, req.bookingId, flightId, req.seatCount]
            );

            const [rows] = await client.query<RowDataPacket[]>(
                `SELECT * FROM flight_bookings WHERE id = ?`,
                [newId]
            );

            await client.query("COMMIT");

            return rows[0] as FlightBooking;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }

    async confirmFlightBooking(req: Airline2FlightBookingConfirmationRequest): Promise<FlightBooking> {
        const client = await this.pool.getConnection();
        try {
            await client.query("BEGIN");

            const [existing] = await client.query<RowDataPacket[]>(
                `SELECT * FROM flight_bookings WHERE booking_id = ? LIMIT 1`,
                [req.bookingId]
            );

            if (existing.length === 0) {
                throw new Error(`Flight booking for bookingId ${req.bookingId} not found`);
            }

            const booking = existing[0] as FlightBooking;

            // idempotency: already confirmed
            if (booking.status === 'CONFIRMED') {
                await client.query("COMMIT");
                return booking;
            }

            if (booking.status !== 'BLOCKED') {
                throw new Error(`Flight booking is in ${booking.status} state, cannot confirm`);
            }

            await client.query(
                `UPDATE flight_bookings SET status = 'CONFIRMED', updated_at = NOW() WHERE booking_id = ?`,
                [req.bookingId]
            );

            const [rows] = await client.query<RowDataPacket[]>(
                `SELECT * FROM flight_bookings WHERE booking_id = ?`,
                [req.bookingId]
            );

            await client.query("COMMIT");

            return rows[0] as FlightBooking;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }

    async getConfirmedBookings(): Promise<FlightBooking[]> {
        const client = await this.pool.getConnection();
        try {
            const [rows] = await client.query<RowDataPacket[]>(
                `SELECT * FROM flight_bookings WHERE status = 'CONFIRMED' ORDER BY created_at DESC`
            );
            return rows as FlightBooking[];
        } finally {
            client.release();
        }
    }

    async cancelFlightBooking(req: Airline2FlightBookingCancelRequest): Promise<FlightBooking> {
        const client = await this.pool.getConnection();
        try {
            await client.query("BEGIN");

            const [existing] = await client.query<RowDataPacket[]>(
                `SELECT * FROM flight_bookings WHERE booking_id = ? LIMIT 1`,
                [req.bookingId]
            );

            if (existing.length === 0) {
                throw new Error(`Flight booking for bookingId ${req.bookingId} not found`);
            }

            const booking = existing[0] as FlightBooking;

            // idempotency: already cancelled
            if (booking.status === 'CANCELLED') {
                await client.query("COMMIT");
                return booking;
            }

            if (booking.status !== 'BLOCKED') {
                throw new Error(`Flight booking is in ${booking.status} state, cannot cancel`);
            }

            await client.query(
                `UPDATE flight_bookings SET status = 'CANCELLED', updated_at = NOW() WHERE booking_id = ?`,
                [req.bookingId]
            );

            await client.query(
                `UPDATE flights SET available_seat_count = available_seat_count + ? WHERE flight_id = ?`,
                [booking.booking_count, booking.flight_id]
            );

            const [rows] = await client.query<RowDataPacket[]>(
                `SELECT * FROM flight_bookings WHERE booking_id = ?`,
                [req.bookingId]
            );

            await client.query("COMMIT");

            return rows[0] as FlightBooking;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }
}
