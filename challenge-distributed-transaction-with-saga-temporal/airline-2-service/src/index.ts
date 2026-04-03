import express from "express";
import { MySQLPool } from "nurburg-libs";
import {
    Airline2FlightBookingBlockRequest,
    Airline2FlightBookingConfirmationRequest,
    Airline2FlightBookingCancelRequest,
} from "./models";
import { Airline2Service } from "./service";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;

const pool = new MySQLPool({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});

const service = new Airline2Service(pool);

app.use(express.json());

app.get("/healthcheck", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.post("/flight-bookings", async (req, res, next) => {
    try {
        const body = Airline2FlightBookingBlockRequest.parse(req.body);
        const booking = await service.blockFlightBooking(body);
        res.status(200).json(booking);
    } catch (err) {
        next(err);
    }
});

app.post("/flight-bookings/confirm", async (req, res, next) => {
    try {
        const body = Airline2FlightBookingConfirmationRequest.parse(req.body);
        const booking = await service.confirmFlightBooking(body);
        res.status(200).json(booking);
    } catch (err) {
        next(err);
    }
});

app.post("/flight-bookings/cancel", async (req, res, next) => {
    try {
        const body = Airline2FlightBookingCancelRequest.parse(req.body);
        const booking = await service.cancelFlightBooking(body);
        res.status(200).json(booking);
    } catch (err) {
        next(err);
    }
});

app.get("/flight-bookings", async (_req, res, next) => {
    try {
        const bookings = await service.getConfirmedBookings();
        res.status(200).json(bookings);
    } catch (err) {
        next(err);
    }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
    console.log(`airline-2-service running on port ${PORT}`);
});
