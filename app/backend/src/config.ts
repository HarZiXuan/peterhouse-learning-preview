import crypto from "node:crypto";
import path from "node:path";
import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4100),
  DATABASE_URL: z.string().default("postgres://peterhouse:peterhouse@127.0.0.1:5432/peterhouse"),
  /** "id:base64key,id2:base64key2": 32-byte keys; the first one encrypts new data, the rest still decrypt old data. */
  DATA_ENCRYPTION_KEYS: z.string().optional(),
  /** The address people type in the browser, e.g. https://reviews.example.com. Used for the CSRF origin check. */
  PUBLIC_ORIGIN: z.string().optional(),
  /** Where the backend's own browser reaches the frontend to print PDFs. */
  FRONTEND_INTERNAL_URL: z.string().default("http://127.0.0.1:3000"),
  COOKIE_SECURE: z.string().optional(),
  SESSION_IDLE_HOURS: z.coerce.number().default(12),
  SESSION_MAX_DAYS: z.coerce.number().default(7),
  /** Login attempts allowed per IP address every 15 minutes. */
  LOGIN_RATE_LIMIT: z.coerce.number().int().default(20),
  AI_PROVIDER: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  LOCAL_AI_URL: z.string().optional(),
  LOCAL_AI_MODEL: z.string().optional(),
  CHROME_PATH: z.string().optional(),
  CHROME_NO_SANDBOX: z.string().optional(),
  MIGRATIONS_DIR: z.string().optional(),
  SKILL_DIR: z.string().optional(),
});

const env = Env.parse(process.env);
const prod = env.NODE_ENV === "production";

// A fixed, publicly known key is fine for local development and tests, and never for a real server.
const DEV_KEY = `dev:${crypto.createHash("sha256").update("peterhouse-dev-only-key").digest("base64")}`;
if (prod && !env.DATA_ENCRYPTION_KEYS) {
  throw new Error("DATA_ENCRYPTION_KEYS is required in production. Generate one with `pnpm --filter @peterhouse/backend gen-key`.");
}

export const config = {
  env: env.NODE_ENV,
  isProd: prod,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  encryptionKeys: env.DATA_ENCRYPTION_KEYS ?? DEV_KEY,
  publicOrigin: env.PUBLIC_ORIGIN,
  frontendInternalUrl: env.FRONTEND_INTERNAL_URL.replace(/\/$/, ""),
  cookieSecure: env.COOKIE_SECURE === "1" || (prod && env.COOKIE_SECURE !== "0"),
  sessionIdleMs: env.SESSION_IDLE_HOURS * 3_600_000,
  sessionMaxMs: env.SESSION_MAX_DAYS * 86_400_000,
  loginRateLimit: env.LOGIN_RATE_LIMIT,
  ai: {
    provider: env.AI_PROVIDER,
    geminiKey: env.GEMINI_API_KEY ?? "",
    openaiKey: env.OPENAI_API_KEY ?? "",
    geminiModel: env.GEMINI_MODEL,
    openaiModel: env.OPENAI_MODEL,
    localUrl: env.LOCAL_AI_URL,
    localModel: env.LOCAL_AI_MODEL,
  },
  chromePath: env.CHROME_PATH,
  chromeNoSandbox: env.CHROME_NO_SANDBOX === "1",
  migrationsDir: path.resolve(env.MIGRATIONS_DIR ?? path.join(process.cwd(), "db", "migrations")),
  skillDir: path.resolve(env.SKILL_DIR ?? path.join(process.cwd(), "skills")),
};
