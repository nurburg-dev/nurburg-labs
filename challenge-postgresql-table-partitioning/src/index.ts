import express, { Request, Response } from "express";
import { pool } from "./db";
import { TransactionQuerySchema } from "./types";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/healthcheck", async (_req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "error" });
  }
});

app.get("/transactions", async (req: Request, res: Response) => {
  const parsed = TransactionQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid query parameters", details: parsed.error.errors });
    return;
  }

  const { start_date, end_date, user_id, transaction_type, limit } =
    parsed.data;
  const start = Date.now();

  try {
    const conditions: string[] = [
      "transaction_date >= $1",
      "transaction_date <= $2",
    ];
    const params: (string | number)[] = [start_date, end_date];
    let paramIdx = 3;

    if (user_id !== undefined) {
      conditions.push(`user_id = $${paramIdx++}`);
      params.push(user_id);
    }
    if (transaction_type !== undefined) {
      conditions.push(`transaction_type = $${paramIdx++}`);
      params.push(transaction_type);
    }

    const whereClause = conditions.join(" AND ");

    const [transactionsResult, statsResult] = await Promise.all([
      pool.query(
        `SELECT id, user_id, transaction_type, amount, currency, transaction_date, status, payment_method
         FROM transaction_logs
         WHERE ${whereClause}
         ORDER BY transaction_date DESC
         LIMIT $${paramIdx}`,
        [...params, limit]
      ),
      pool.query(
        `SELECT
           COUNT(*) AS total_count,
           COALESCE(SUM(amount), 0) AS total_amount,
           COALESCE(AVG(amount), 0) AS avg_amount,
           COUNT(DISTINCT user_id) AS unique_users
         FROM transaction_logs
         WHERE ${whereClause}`,
        params
      ),
    ]);

    res.json({
      transactions: transactionsResult.rows,
      stats: statsResult.rows[0],
      meta: {
        query_time_ms: Date.now() - start,
        count: transactionsResult.rows.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
