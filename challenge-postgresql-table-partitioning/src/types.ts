import { z } from "zod";

export const TransactionQuerySchema = z.object({
  start_date: z
    .string({ required_error: "start_date is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be YYYY-MM-DD"),
  end_date: z
    .string({ required_error: "end_date is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "end_date must be YYYY-MM-DD"),
  user_id: z.string().regex(/^\d+$/).transform(Number).optional(),
  transaction_type: z
    .enum(["purchase", "refund", "transfer"])
    .optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).default("100"),
});

export type TransactionQuery = z.infer<typeof TransactionQuerySchema>;

export interface TransactionStats {
  total_count: string;
  total_amount: string;
  avg_amount: string;
  unique_users: string;
}

export interface TransactionRow {
  id: string;
  user_id: number;
  transaction_type: string;
  amount: string;
  currency: string;
  transaction_date: string;
  status: string;
  payment_method: string | null;
}
