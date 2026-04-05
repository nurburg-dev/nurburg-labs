import { hookedFetch } from "nurburg-libs";

interface FlightBookingBlockRequest {
    bookingId: string;
    flightDate: string;
    seatCount: number;
}

interface FlightBookingStateRequest {
    bookingId: string;
}

interface FlightBooking {
    id: string;
    booking_id: string;
    flight_id: string;
    status: string;
    booking_count: number;
    created_at: string;
    updated_at: string;
}

const ndFetch = hookedFetch(fetch)

// TODO: create hooked fetch api
async function post<T>(url: string, body: unknown): Promise<T> {
    const res = await ndFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`${url} responded ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
}

export class Airline1Client {
    private readonly baseUrl: string;

    constructor(baseUrl: string = process.env.AIRLINE1_URL ?? "http://airline-1-service:4000") {
        this.baseUrl = baseUrl;
    }

    blockFlightBooking(req: FlightBookingBlockRequest): Promise<FlightBooking> {
        return post(`${this.baseUrl}/flight-bookings/block`, req);
    }

    confirmFlightBooking(req: FlightBookingStateRequest): Promise<FlightBooking> {
        return post(`${this.baseUrl}/flight-bookings/confirm`, req);
    }

    cancelFlightBooking(req: FlightBookingStateRequest): Promise<FlightBooking> {
        return post(`${this.baseUrl}/flight-bookings/cancel`, req);
    }
}

export class Airline2Client {
    private readonly baseUrl: string;

    constructor(baseUrl: string = process.env.AIRLINE2_URL ?? "http://airline-2-service:5000") {
        this.baseUrl = baseUrl;
    }

    blockFlightBooking(req: FlightBookingBlockRequest): Promise<FlightBooking> {
        return post(`${this.baseUrl}/flight-bookings/block`, req);
    }

    confirmFlightBooking(req: FlightBookingStateRequest): Promise<FlightBooking> {
        return post(`${this.baseUrl}/flight-bookings/confirm`, req);
    }

    cancelFlightBooking(req: FlightBookingStateRequest): Promise<FlightBooking> {
        return post(`${this.baseUrl}/flight-bookings/cancel`, req);
    }
}
