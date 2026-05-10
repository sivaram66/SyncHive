import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: 'C:/Projects/Synchive/.env' })

console.log('REDIS_URL:', process.env.REDIS_URL?.replace(/:([^:@]+)@/, ':***@') ?? 'MISSING')
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING')

import IORedis from 'ioredis'
import { Queue } from 'bullmq'

const redis = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: {},
})

const queue = new Queue('workflow-execution', { connection: redis })

await queue.add('test-job', { test: true }, { jobId: 'debug-test-123' })
console.log('✅ Job added to queue successfully')

const waiting = await queue.getWaiting()
console.log('Waiting jobs after add:', waiting.length)

await redis.disconnect()