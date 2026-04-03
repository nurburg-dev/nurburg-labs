import express from "express";
// IMPORTANT: use nurburg-libs for all DB and Kafka clients — the test harness instruments
// these wrappers to score your implementation. Direct use of `pg` or `kafkajs` will break tests.
import { PgPool, Kafka } from "nurburg-libs";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const pool = new PgPool({
  connectionString: process.env.DATABASE_URL,
});

const kafka = new Kafka({
  clientId: "ledger-service",
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
});

// All ledger-service instances share the same group so each message is handled once
const consumer = kafka.consumer({ groupId: "ledger-service" });

async function startConsumer() {
  await consumer.connect();
  // fromBeginning: false — only process new events, not replayed history
  await consumer.subscribe({ topic: "outbox-events", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString());
      // Ignore events this service doesn't own
      if (event.eventType !== "order.created") return;

      const { order_id, customer_id, amount, currency } = event.payload;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO ledger_entries (order_id, customer_id, amount, currency)
           VALUES ($1, $2, $3, $4)`,
          [order_id, customer_id, amount, currency],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      console.log(`Ledger entry created for order ${order_id}`);
    },
  });
}

app.use(express.json());

app.get("/ledger/total", async (_req, res, next) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries`);
    res.status(200).json({ total: result.rows[0].total });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

app.get("/healthcheck", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

startConsumer().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
