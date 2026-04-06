import { z } from "zod";

// Login request schema
export const LoginRequestSchema = z.object({
  email: z.string(),
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// User type from database
export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: Date;
}

// JWT payload
export interface JWTPayload {
  userId: number;
  email: string;
}

// API response types
export interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
}
