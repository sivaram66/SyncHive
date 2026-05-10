import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  syncIntervalMs: parseInt(process.env.SCHEDULER_SYNC_INTERVAL_MS ?? '300000'),
};

if (!config.databaseUrl) throw new Error('DATABASE_URL environment variable is not set');
if (!config.redisUrl) throw new Error('REDIS_URL environment variable is not set');