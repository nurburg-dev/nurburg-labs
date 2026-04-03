import express from "express";
import { PgPool } from "nurburg-libs";
import {
    Airline1FlightBookingBlockRequest,
    Airline1FlightBookingConfirmationRequest,
    Airline1FlightBookingCancelRequest,
} from "./models";
import { Airline1Service } from "./service";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

const pool = new PgPool({ connectionString: process.env.DATABASE_URL });
const service = new Airline1Service(pool);

app.use(express.json());

app.get("/healthcheck", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.post("/flight-bookings", async (req, res, next) => {
    try {
        const body = Airline1FlightBookingBlockRequest.parse({
            ...req.body,
            flightDate: new Date(req.body.flightDate),
        });
        const booking = await service.blockFlightBooking(body);
        res.status(200).json(booking);
    } catch (err) {
        next(err);
    }
});

app.post("/flight-bookings/confirm", async (req, res, next) => {
    try {
        const body = Airline1FlightBookingConfirmationRequest.parse(req.body);
        const booking = await service.confirmFlightBooking(body);
        res.status(200).json(booking);
    } catch (err) {
        next(err);
    }
});

app.post("/flight-bookings/cancel", async (req, res, next) => {
    try {
        const body = Airline1FlightBookingCancelRequest.parse(req.body);
        const booking = await service.cancelFlightBooking(body);
        res.status(200).json(booking);
    } catch (err) {
        next(err);
    }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
    console.log(`airline-1-service running on port ${PORT}`);
});
