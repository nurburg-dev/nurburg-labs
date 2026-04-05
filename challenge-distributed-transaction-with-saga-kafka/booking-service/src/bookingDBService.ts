import { PgPool } from "nurburg-libs";
import { z } from "zod";
import { Airline1Client, Airline2Client } from "./airlineClients";
import { BookingRequest } from "./models";

interface Booking {
    booking_id: string;
    customer_id: string;
    status: string;
    total_amount: number;
    created_at: Date;
    updated_at: Date;
}

export class BookingDBService {
    constructor(
        private readonly pool: PgPool,
        private readonly airline1: Airline1Client,
        private readonly airline2: Airline2Client,
    ) {}

    async createPendingBooking(bookingId: string, customerId: string, totalAmount: number): Promise<Booking> {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await client.query(
                `INSERT INTO bookings (booking_id, customer_id, status, total_amount)
                 VALUES ($1, $2, 'PENDING', $3)
                 RETURNING *`,
                [bookingId, customerId, totalAmount]
            );
            await client.query("COMMIT");
            return result.rows[0] as Booking;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }

    async confirmPendingBooking(bookingId: string): Promise<Booking> {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await client.query(
                `UPDATE bookings SET status = 'CONFIRMED', updated_at = NOW()
                 WHERE booking_id = $1 AND status = 'PENDING'
                 RETURNING *`,
                [bookingId]
            );
            if (result.rowCount === 0) {
                throw new Error(`Booking ${bookingId} not found or not in PENDING state`);
            }
            await client.query("COMMIT");
            return result.rows[0] as Booking;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }

    async cancelBooking(bookingId: string): Promise<Booking> {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await client.query(
                `UPDATE bookings SET status = 'CANCELLED', updated_at = NOW()
                 WHERE booking_id = $1
                 RETURNING *`,
                [bookingId]
            );
            if (result.rowCount === 0) {
                throw new Error(`Booking ${bookingId} not found`);
            }
            await client.query("COMMIT");
            return result.rows[0] as Booking;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }

    // Naive SAGA: sequential steps, no reliable execution guarantee.
    // Each successful step pushes a compensation; on failure they run in reverse.
    async orchestrateBookingSaga(bookingId: string, request: z.infer<typeof BookingRequest>): Promise<Booking> {
        const flightDate = request.date.toISOString().split("T")[0];
        const blockReq = { bookingId, flightDate, seatCount: request.seats };
        const compensations: Array<() => Promise<unknown>> = [];

        try {
            await this.airline1.blockFlightBooking(blockReq);
            compensations.push(() => this.airline1.cancelFlightBooking({ bookingId }));

            await this.airline2.blockFlightBooking(blockReq);
            compensations.push(() => this.airline2.cancelFlightBooking({ bookingId }));

            await this.createPendingBooking(bookingId, request.customerId, request.amount);
            compensations.push(() => this.cancelBooking(bookingId));

            // No compensation pushed after confirms — once an airline confirms a seat,
            // it cannot be undone via a simple cancel; requires a separate refund flow.
            await this.airline1.confirmFlightBooking({ bookingId });
            await this.airline2.confirmFlightBooking({ bookingId });

            return await this.confirmPendingBooking(bookingId);
        } catch (err) {
            for (const compensate of compensations.reverse()) {
                await compensate();
            }
            throw err;
        }
    }
}
