import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",

  // Database
  databaseUrl: requireEnv("DATABASE_URL"),

  // Redis
  redisUrl: requireEnv("REDIS_URL"),

  // Engine settings
  maxConcurrency: parseInt(process.env.ENGINE_CONCURRENCY || "5", 10),
  stepConcurrency: parseInt(process.env.STEP_CONCURRENCY || "10", 10),
} as const;