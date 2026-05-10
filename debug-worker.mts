import dotenv from 'dotenv'
dotenv.config({ path: 'C:/Projects/Synchive/.env' })

import { Worker } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: {},
})

console.log('REDIS_URL being used:', process.env.REDIS_URL?.replace(/:([^:@]+)@/, ':***@'))

const worker = new Worker('workflow-execution', async (job) => {
  console.log('🎉 JOB PICKED UP:', job.id)
  console.log('Job data:', JSON.stringify(job.data, null, 2))
  // just complete successfully without processing
}, { connection })

worker.on('completed', (job) => console.log('✅ Completed:', job.id))
worker.on('failed', (job, err) => console.log('❌ Failed:', job?.id, err.message))

worker.on('error', (err) => console.log('Worker error:', err.message))
worker.on('ready', () => console.log('Worker ready and listening'))
worker.on('failed', (job, err) => console.log('Job failed:', err.message))

console.log('Worker started, waiting for jobs...')


// Add at the bottom of debug-worker.mts before the setTimeout
import { Queue } from 'bullmq'
const q = new Queue('workflow-execution', { connection })
const waiting = await q.getWaiting()
const delayed = await q.getDelayed()
const active = await q.getActive()
console.log('Waiting jobs:', waiting.length)
console.log('Active jobs:', active.length)
console.log('Delayed jobs:', delayed.length)
const completed = await q.getCompleted()
console.log('Completed jobs:', completed.length, completed.map(j => j.id))
// Keep alive
setTimeout(() => {}, 30000)