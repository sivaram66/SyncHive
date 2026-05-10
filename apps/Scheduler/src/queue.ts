/**
 * Re-export queue utilities from the shared @synchive/queue package.
 * The scheduler only needs enqueueExecution — it never processes jobs.
 */
export { enqueueExecution, closeRedisConnection as closeQueue } from '@synchive/queue';