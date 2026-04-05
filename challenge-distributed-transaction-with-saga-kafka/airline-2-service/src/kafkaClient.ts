import { Kafka } from "nurburg-libs";

// Kafka client for airline-2-service.
// Consumes saga commands from the `airline-2` topic.
// Publishes saga replies to the `booking-service` topic.
export const kafka = new Kafka({
    clientId: "airline-2-service",
    brokers: (process.env.KAFKA_BROKERS ?? "kafka:9092").split(","),
});

// --- Consuming commands ---
//
// const consumer = kafka.consumer({ groupId: "airline-2-group" });
// await consumer.connect();
// await consumer.subscribe({ topic: "airline-2", fromBeginning: false });
// await consumer.run({
//     eachMessage: async ({ message }) => {
//         const event = JSON.parse(message.value!.toString());
//         // handle event.type: "BLOCK" | "CONFIRM" | "CANCEL"
//     },
// });

// --- Publishing a reply ---
//
// const producer = kafka.producer();
// await producer.connect();
// await producer.send({
//     topic: "booking-service",
//     messages: [{ key: bookingId, value: JSON.stringify({ type: "BLOCK_SUCCESS", bookingId }) }],
// });
