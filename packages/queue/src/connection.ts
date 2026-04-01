import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set");
    }

    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false, // faster startup with Upstash
      retryStrategy: (times: number) => {
        if (times > 10) return null; // stop retrying after 10 attempts
        return Math.min(times * 200, 5000); // exponential backoff, max 5s
      },
    });

    connection.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    connection.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });
  }

  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}