import dotenv from "dotenv";
import path from "path";

// Fix: use process.cwd() instead of __dirname (not available in ESM/tsx)
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: requireEnv("DATABASE_URL"),
  redisUrl: requireEnv("REDIS_URL"),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "10", 10),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
} as const;