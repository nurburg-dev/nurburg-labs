import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.DB_HOST || "ticketsdb",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER || "user",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "ticketsdb",
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
