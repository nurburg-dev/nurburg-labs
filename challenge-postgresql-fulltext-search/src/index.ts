import express, { Request, Response } from "express";
import { z } from "zod";
import { pool } from "./db";
import { SearchResponse, ErrorResponse } from "./types";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const SearchQuerySchema = z.object({
  q: z.string().min(1, "query param `q` is required"),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

app.get("/healthcheck", (_req: Request, res: Response) => {
  res.send("OK");
});

/*
 * BUGS observed:
 * 1. Searching "crashes" returns no results even when tickets mention "crash" or "crashed"
 * 2. A ticket where the query appears only in the body ranks the same as one where it's in the title
 * 3. Searching by a tag value (e.g. "redis") returns no results unless the word also appears in the text
 */
app.get(
  "/tickets/search",
  async (req: Request, res: Response<SearchResponse | ErrorResponse>) => {
    const parsed = SearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { q, status, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    try {
      const { rows } = await pool.query(
        `SELECT id, title, tags, status, created_at, COUNT(*) OVER () AS total_count
         FROM tickets
         WHERE search_vector @@ websearch_to_tsquery('pg_catalog.simple', $1)
           ${status ? "AND status = $4" : ""}
         ORDER BY updated_at DESC
         LIMIT $2 OFFSET $3`,
        status ? [q, limit, offset, status] : [q, limit, offset],
      );

      res.json({
        data: rows.map(({ total_count, ...r }) => r),
        meta: { total: Number(rows[0]?.total_count ?? 0), page, limit },
      });
    } catch (err) {
      console.error("[search] query failed", err);
      res.status(500).json({ error: "search unavailable" });
    }
  },
);

app.listen(PORT, async () => {
  try {
    await pool.query("SELECT 1");
    console.log(`Server running on port ${PORT}`);
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }
});
