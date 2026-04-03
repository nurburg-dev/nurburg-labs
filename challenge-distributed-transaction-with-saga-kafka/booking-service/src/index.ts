import express from "express";
import { randomUUID } from "crypto";
import { PgPool } from "nurburg-libs";
import { BookingRequest } from "./models";
import { BookingDBService } from "./bookingDBService";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const pool = new PgPool({ connectionString: process.env.DATABASE_URL });
const bookingDB = new BookingDBService(pool);

app.use(express.json());

app.get("/healthcheck", (_req, res) => {
	res.status(200).json({ status: "ok" });
});

app.post("/bookings", async (req, res, next) => {
	try {
		const body = BookingRequest.parse(req.body);
		const bookingId = randomUUID();
		const booking = await bookingDB.createPendingBooking(
			bookingId,
			body.customerId,
			body.amount,
		);
		res.status(200).json(booking);
	} catch (err) {
		next(err);
	}
});

app.get("/bookings", async (_req, res, next) => {
	const client = await pool.connect();
	try {
		const result = await client.query(
			`SELECT * FROM bookings WHERE status = 'CONFIRMED' ORDER BY created_at DESC`,
		);
		res.status(200).json(result.rows);
	} catch (err) {
		next(err);
	} finally {
		client.release();
	}
});

app.use(
	(
		err: Error,
		_req: express.Request,
		res: express.Response,
		_next: express.NextFunction,
	) => {
		console.error(err);
		res.status(500).json({ error: err.message });
	},
);

app.listen(PORT, () => {
	console.log(`booking-service running on port ${PORT}`);
});
