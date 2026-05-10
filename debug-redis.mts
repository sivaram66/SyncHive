import dotenv from 'dotenv'
dotenv.config({ path: 'C:/Projects/Synchive/.env' })

import IORedis from 'ioredis'

const redis = new IORedis(process.env.REDIS_URL!, {
  tls: {},
  maxRetriesPerRequest: null,
})

redis.on('connect', () => console.log('Connected'))
redis.on('error', (e) => console.log('Error:', e.message))

const keys = await redis.keys('*')
console.log('All Redis keys:', keys)

const jobCount = await redis.llen('bull:workflow-execution:wait')
console.log('Jobs waiting:', jobCount)

redis.disconnect()