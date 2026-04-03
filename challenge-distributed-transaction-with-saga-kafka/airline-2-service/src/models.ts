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
export const Airline2FlightBookingBlockRequest = z.object({
    bookingId: z.string(),
    flightDate: z.date(),
    seatCount: z.int(),
})
export type Airline2FlightBookingBlockRequest = z.infer<typeof Airline2FlightBookingBlockRequest>

// flight booking state transition request "BLOCKED" -> "CONFIRMED"
export const Airline2FlightBookingConfirmationRequest = z.object({
    bookingId: z.string(),
})
export type Airline2FlightBookingConfirmationRequest = z.infer<typeof Airline2FlightBookingConfirmationRequest>

// flight booking state transition request "BLOCKED" -> "CANCELLED"
export const Airline2FlightBookingCancelRequest = z.object({
    bookingId: z.string(),
})
export type Airline2FlightBookingCancelRequest = z.infer<typeof Airline2FlightBookingCancelRequest>
