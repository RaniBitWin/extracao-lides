import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentFilePath = fileURLToPath(import.meta.url);
const configDirectory = dirname(currentFilePath);
const backendRoot = resolve(configDirectory, "../..");
const workspaceRoot = resolve(backendRoot, "..");

config({ path: resolve(workspaceRoot, ".env") });
config({ path: resolve(backendRoot, ".env"), override: false });

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
  GEOAPIFY_API_KEY: z.string().optional(),
  GEOAPIFY_DAILY_CREDIT_LIMIT: z.coerce.number().int().positive().default(3000),
  GEOAPIFY_REQUESTS_PER_SECOND: z.coerce.number().int().positive().default(5),
  GEOAPIFY_PAGE_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  GEOAPIFY_SEARCH_RADIUS_METERS: z.coerce
    .number()
    .int()
    .min(100)
    .max(50000)
    .default(5000),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Falha ao validar variaveis de ambiente.");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
