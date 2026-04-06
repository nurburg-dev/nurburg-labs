import { Client, Connection } from "@temporalio/client";

// Temporal client for booking-service.
// Starts saga workflows and interacts with running workflow instances.
export async function createTemporalClient(): Promise<Client> {
    const connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS ?? "temporal:7233",
    });
    return new Client({ connection });
}

// --- Starting a workflow ---
//
// const client = await createTemporalClient();
// await client.workflow.start(bookingSagaWorkflow, {
//     taskQueue: "booking-saga",
//     workflowId: bookingId,
//     args: [{ bookingId, flightDate, seatCount, customerId, totalAmount }],
// });

// --- Signalling a running workflow ---
//
// const handle = client.workflow.getHandle(bookingId);
// await handle.signal(airlineReplySignal, { type: "BLOCK_SUCCESS", airline: "airline-1" });

// --- Querying a workflow ---
//
// const handle = client.workflow.getHandle(bookingId);
// const status = await handle.query(bookingStatusQuery);
