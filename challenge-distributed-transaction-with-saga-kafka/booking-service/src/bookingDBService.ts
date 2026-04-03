import { PgPool } from "nurburg-libs";

interface Booking {
    booking_id: string;
    customer_id: string;
    status: string;
    total_amount: number;
    created_at: Date;
    updated_at: Date;
}

export class BookingDBService {
    constructor(private readonly pool: PgPool) {}

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
}
