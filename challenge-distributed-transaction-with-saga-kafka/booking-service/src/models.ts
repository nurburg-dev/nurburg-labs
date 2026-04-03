import * as z from "zod"; 

export const BookingRequest = z.object({
    customerId: z.string(),
    amount: z.number(),
    seats: z.int(),
    date: z.date(),
    flightLegs: z.array(z.object({
        airlines: z.string(),
        flightNumber: z.string(),
    }))
})

export const BookingResponse = z.object({
    bookingId: z.string(),
})