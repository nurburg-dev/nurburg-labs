import express from "express";
// IMPORTANT: use nurburg-libs for all DB and Kafka clients — the test harness instruments
// these wrappers to score your implementation. Direct use of `pg` or `kafkajs` will break tests.
import { PgPool, Kafka } from "nurburg-libs";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Connection pool — reuses pg connections across requests
const pool = new PgPool({
  connectionString: process.env.DATABASE_URL,
});

// Kafka client scoped to this service
const kafka = new Kafka({
  clientId: "order-service",
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
});

const producer = kafka.producer();

// Connect the producer before the server starts accepting traffic
async function init() {
  await producer.connect();
}

app.use(express.json());

app.get("/healthcheck", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/orders/total", async (_req, res, next) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM orders`);
    res.status(200).json({ total: result.rows[0].total });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

app.post("/orders", async (req, res, next) => {
  const { customerId, amount, currency = "USD" } = req.body;

  // Acquire a dedicated client so BEGIN/COMMIT are scoped to this connection
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Write the order row inside the open transaction
    const result = await client.query(
      `INSERT INTO orders (order_id, customer_id, amount, currency)
       VALUES (gen_random_uuid(), $1, $2, $3)
       RETURNING *`,
      [customerId, amount, currency],
    );

    const order = result.rows[0];

    // Publish to Kafka *before* COMMIT — if the send fails the transaction rolls back,
    // keeping the DB and the event stream consistent.
    await producer.send({
      topic: "outbox-events",
      messages: [
        {
          key: String(order.id),
          value: JSON.stringify({
            eventType: "order.created",
            payload: order,
          }),
        },
      ],
    });

    await client.query("COMMIT");

    res.status(200).json(order);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    // Always return the client to the pool
    client.release();
  }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

init().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
