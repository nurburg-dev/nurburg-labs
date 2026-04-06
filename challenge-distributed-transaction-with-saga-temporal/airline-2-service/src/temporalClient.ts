import { NativeConnection, Worker } from "@temporalio/worker";

// Temporal worker for airline-2-service.
// Registers activity implementations on the `booking-saga` task queue.
// The orchestrator workflow calls these activities to perform local transactions.
export async function createWorker(activities: Record<string, (...args: unknown[]) => unknown>): Promise<Worker> {
    const connection = await NativeConnection.connect({
        address: process.env.TEMPORAL_ADDRESS ?? "temporal:7233",
    });
    return Worker.create({
        connection,
        namespace: "default",
        taskQueue: "booking-saga",
        activities,
    });
}

// --- Registering and running activities ---
//
// const worker = await createWorker({
//     blockFlightBooking: async ({ bookingId, flightDate, seatCount }) => {
//         // perform local DB transaction, throw on failure
//     },
//     confirmFlightBooking: async ({ bookingId }) => {
//         // confirm the blocked seat
//     },
//     cancelFlightBooking: async ({ bookingId }) => {
//         // compensating transaction — release the blocked seat
//     },
// });
// await worker.run();  // polls task queue until shutdown
