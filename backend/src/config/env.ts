import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
  DEFAULT_MAX_RESULTS: z.coerce.number().int().min(1).max(100).default(10),
  DEFAULT_SHEET_NAME: z.string().min(1).default("Leads"),
  COLLECTION_MOCK_MODE: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default("true"),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_SHEET_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON_PATH: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Falha ao validar variaveis de ambiente.");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
