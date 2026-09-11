import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().min(1).default("postgresql://erp_pulse:erp_pulse@localhost:5432/erp_pulse"),
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  ALLOWED_ORIGIN: z.string().default("http://localhost:8000"),
});

export const config = envSchema.parse(process.env);

