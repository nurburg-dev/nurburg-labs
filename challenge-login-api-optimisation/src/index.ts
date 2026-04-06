import express, { Request, Response } from "express";
import { pool } from "./db";
import { verifyPassword, generateToken } from "./auth";
import {
  LoginRequestSchema,
  LoginRequest,
  LoginResponse,
  ErrorResponse,
  User,
} from "./types";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/**
 * Health check endpoint
 */
app.get("/healthcheck", (req: Request, res: Response) => {
  res.send("OK");
});

app.post(
  "/auth/login",
  async (req: Request, res: Response<LoginResponse | ErrorResponse>) => {
    try {
      const validation = LoginRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation Error",
          message: validation.error.errors[0].message,
        });
      }

      const { email, password }: LoginRequest = validation.data;

      const result = await pool.query<User>(
        "SELECT id, email, password_hash, name, created_at FROM users WHERE email = $1",
        [email],
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: "Authentication Failed",
          message: "Invalid email or password",
        });
      }

      const user = result.rows[0];

      const isPasswordValid = await verifyPassword(
        password,
        user.password_hash,
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          error: "Authentication Failed",
          message: "Invalid email or password",
        });
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "An unexpected error occurred",
      });
    }
  },
);

// Start server
app.listen(PORT, async () => {
  try {
    await pool.query("SELECT 1");
    console.log("=".repeat(60));
    console.log("🛒 BLACK FRIDAY SALE - Authentication Service");
    console.log("=".repeat(60));
    console.log(`Server running: http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/healthcheck`);
    console.log(`Login endpoint: POST http://localhost:${PORT}/auth/login`);
    console.log("=".repeat(60));
    console.log("⚠️  Customers are complaining about login timeouts!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  }
});
