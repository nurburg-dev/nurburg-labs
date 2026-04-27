import express, { Request, Response } from "express";
import { Pool } from "pg";
import Redis from "ioredis";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const CACHE_TTL_SECONDS = 60;

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: string;
}

app.get("/healthcheck", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

// GET /product/:id — naive cache-aside with no stampede protection.
// When the 60-second TTL fires under high concurrency, every in-flight request
// misses the cache and queries Postgres simultaneously, saturating the DB.
app.get("/product/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const cacheKey = `product:${id}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      res.json(JSON.parse(cached));
      return;
    }

    // Cache miss — every concurrent request for the same key hits Postgres.
    const result = await db.query<Product>(
      "SELECT id, name, description, price FROM products WHERE id = $1",
      [id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "product not found" });
      return;
    }

    const product = result.rows[0];
    await redis.set(cacheKey, JSON.stringify(product), "EX", CACHE_TTL_SECONDS);
    res.json(product);
  } catch (err) {
    console.error("error handling /product/:id", err);
    res.status(500).json({ error: "internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`cache-stampede service listening on port ${PORT}`);
});
