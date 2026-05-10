/**
 * Re-export the shared DB connection for use in the scheduler.
 * The scheduler uses the same @synchive/db package as the rest of the monorepo
 * so schema changes propagate automatically.
 */
export { createDb, workflows, workflowNodes, workflowVersions, workflowExecutions } from '@synchive/db';