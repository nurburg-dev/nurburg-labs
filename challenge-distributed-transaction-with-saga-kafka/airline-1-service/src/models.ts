import z from "zod"

export const FlightBooking = z.object({
    id: z.string(),
    booking_id: z.string(),
    flight_id: z.string(),
    status: z.string(),
    booking_count: z.number(),
    created_at: z.date(),
    updated_at: z.date(),
})
export type FlightBooking = z.infer<typeof FlightBooking>

// create flight booking with state "BLOCKED"
export const Airline1FlightBookingBlockRequest = z.object({
    bookingId: z.string(),
    flightDate: z.date(),
    seatCount: z.int(),
})
export type Airline1FlightBookingBlockRequest = z.infer<typeof Airline1FlightBookingBlockRequest>

// flight booking state transition request "BLOCKED" -> "CONFIRMED"
export const Airline1FlightBookingConfirmationRequest = z.object({
    bookingId: z.string(),
})
export type Airline1FlightBookingConfirmationRequest = z.infer<typeof Airline1FlightBookingConfirmationRequest>

// flight booking state transition request "BLOCKED" -> "CANCELLED"
export const Airline1FlightBookingCancelRequest = z.object({
    bookingId: z.string(),
})

export type Airline1FlightBookingCancelRequest = z.infer<typeof Airline1FlightBookingCancelRequest>
