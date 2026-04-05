import { Kafka } from "nurburg-libs";

// Kafka client for booking-service.
// Publishes saga commands to the `airline-1` and `airline-2` topics.
// Consumes saga replies from the `booking-service` topic.
export const kafka = new Kafka({
    clientId: "booking-service",
    brokers: (process.env.KAFKA_BROKERS ?? "kafka:9092").split(","),
});

// --- Publishing a command ---
//
// const producer = kafka.producer();
// await producer.connect();
// await producer.send({
//     topic: "airline-1",                         // target service's topic
//     messages: [{ key: bookingId, value: JSON.stringify({ type: "BLOCK", bookingId, flightDate, seatCount }) }],
// });
// await producer.disconnect();

// --- Consuming replies ---
//
// const consumer = kafka.consumer({ groupId: "booking-service-group" });
// await consumer.connect();
// await consumer.subscribe({ topic: "booking-service", fromBeginning: false });
// await consumer.run({
//     eachMessage: async ({ message }) => {
//         const event = JSON.parse(message.value!.toString());
//         // handle event.type: "BLOCK_SUCCESS" | "BLOCK_FAILURE" | "CONFIRM_SUCCESS" | ...
//     },
// });
