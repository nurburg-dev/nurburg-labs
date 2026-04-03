import express from "express";
// IMPORTANT: use nurburg-libs for all DB and Kafka clients — the test harness instruments
// these wrappers to score your implementation. Direct use of `pg` or `kafkajs` will break tests.
import { PgPool, Kafka } from "nurburg-libs";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const pool = new PgPool({
  connectionString: process.env.DATABASE_URL,
});

// --- Kafka (reference) ---
// const kafka = new Kafka({
//   clientId: "events-service",
//   brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
// });

// // Producer: call connect() once, then send messages to a topic.
// const producer = kafka.producer();
// await producer.connect();
// await producer.send({ topic: "...", messages: [{ key: "...", value: "..." }] });

// // Consumer: subscribe to a topic and process messages one by one.
// const consumer = kafka.consumer({ groupId: "events-service" });
// await consumer.connect();
// await consumer.subscribe({ topic: "...", fromBeginning: false });
// await consumer.run({ eachMessage: async ({ message }) => { /* ... */ } });

app.use(express.json());

app.get("/healthcheck", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// POST /events — ingest a single click event and write it directly to the DB.
app.post("/events", async (req, res, next) => {
  const { session_id, element_id, page_url, x, y } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO click_events (session_id, element_id, page_url, x, y)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [session_id, element_id, page_url, x, y],
    );
    await client.query("COMMIT");
    res.status(201).json({ status: "ok", id: result.rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

app.get("/events/:id", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM click_events WHERE id = $1`,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
