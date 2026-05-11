import * as cron from 'node-cron';
import { eq, and } from 'drizzle-orm';
import { createDb, workflows, workflowNodes, workflowVersions, workflowExecutions } from './db';
import { enqueueExecution } from './queue';
import { createLogger } from '@synchive/logger';
import { config } from './config';

const logger = createLogger({ service: 'scheduler' });
const db = createDb(config.databaseUrl);

// In-memory map of active cron jobs keyed by workflowId
const registeredJobs = new Map<string, cron.ScheduledTask>();

interface ScheduledWorkflow {
  workflowId: string;
  workflowName: string;
  versionId: string;
  cronExpression: string;
  timezone?: string;
}

async function loadScheduledWorkflows(): Promise<ScheduledWorkflow[]> {
  const activeWorkflows = await db
    .select({
      id: workflows.id,
      name: workflows.name,
      currentVersion: workflows.currentVersion,
    })
    .from(workflows)
    .where(eq(workflows.status, 'active'));

  if (activeWorkflows.length === 0) return [];

  const scheduled: ScheduledWorkflow[] = [];

  for (const workflow of activeWorkflows) {
    // Only trigger-type nodes with triggerType === 'schedule' drive cron
    const scheduleNodes = await db
      .select({ config: workflowNodes.config })
      .from(workflowNodes)
      .where(
        and(
          eq(workflowNodes.workflowId, workflow.id),
          eq(workflowNodes.type, 'trigger')
        )
      );

    for (const node of scheduleNodes) {
      const nodeConfig = node.config as Record<string, unknown>;
      if (nodeConfig.triggerType !== 'schedule') continue;

      // NodeConfigPanel saves as `cron`, legacy may use `cronExpression`
      const cronExpression = (nodeConfig.cron ?? nodeConfig.cronExpression) as string | undefined;
      if (!cronExpression) continue;
      if (!cron.validate(cronExpression)) {
        logger.warn({ workflowId: workflow.id, cronExpression }, 'Invalid cron expression, skipping');
        continue;
      }

      const [version] = await db
        .select({ id: workflowVersions.id })
        .from(workflowVersions)
        .where(
          and(
            eq(workflowVersions.workflowId, workflow.id),
            eq(workflowVersions.version, workflow.currentVersion)
          )
        )
        .limit(1);

      if (!version) continue;

      scheduled.push({
        workflowId: workflow.id,
        workflowName: workflow.name,
        versionId: version.id,
        cronExpression,
        timezone: nodeConfig.timezone as string | undefined,
      });
    }
  }

  return scheduled;
}

async function triggerWorkflow(workflow: ScheduledWorkflow): Promise<void> {
  try {
    logger.info({ workflowId: workflow.workflowId, name: workflow.workflowName }, 'Triggering scheduled workflow');

    const triggerData = {
      triggeredAt: new Date().toISOString(),
      triggerType: 'schedule',
      cronExpression: workflow.cronExpression,
    };

    const [execution] = await db
      .insert(workflowExecutions)
      .values({
        workflowId: workflow.workflowId,
        versionId: workflow.versionId,
        status: 'queued',
        triggerData,
      })
      .returning();

    await enqueueExecution({
      executionId: execution.id,
      workflowId: workflow.workflowId,
      versionId: workflow.versionId,
      triggeredBy: 'schedule',
      triggerData,
    });

    logger.info({ executionId: execution.id, workflowId: workflow.workflowId }, 'Scheduled execution enqueued');
  } catch (err) {
    logger.error({ err, workflowId: workflow.workflowId }, 'Failed to trigger scheduled workflow');
  }
}

/**
 * Reconciles cron jobs with the current DB state.
 * Called on startup and periodically to pick up newly activated/deactivated workflows.
 */
export async function syncSchedules(): Promise<void> {
  logger.info('Syncing schedules from database');

  let scheduledWorkflows: ScheduledWorkflow[];
  try {
    scheduledWorkflows = await loadScheduledWorkflows();
  } catch (err) {
    logger.error({ err }, 'Failed to load scheduled workflows');
    return;
  }

  const activeWorkflowIds = new Set(scheduledWorkflows.map((w) => w.workflowId));

  // Stop jobs for workflows that are no longer active
  for (const [workflowId, task] of registeredJobs.entries()) {
    if (!activeWorkflowIds.has(workflowId)) {
      task.stop();
      registeredJobs.delete(workflowId);
      logger.info({ workflowId }, 'Unregistered cron job');
    }
  }

  // Register new jobs for newly discovered workflows
  for (const workflow of scheduledWorkflows) {
    if (registeredJobs.has(workflow.workflowId)) continue;

    const task = cron.schedule(
      workflow.cronExpression,
      () => triggerWorkflow(workflow),
      { timezone: workflow.timezone ?? 'UTC', scheduled: true }
    );

    registeredJobs.set(workflow.workflowId, task);

    logger.info(
      {
        workflowId: workflow.workflowId,
        workflowName: workflow.workflowName,
        cronExpression: workflow.cronExpression,
        timezone: workflow.timezone ?? 'UTC',
      },
      'Registered cron job'
    );
  }

  logger.info({ activeJobs: registeredJobs.size }, 'Schedule sync complete');
}

export function stopAllSchedules(): void {
  for (const [workflowId, task] of registeredJobs.entries()) {
    task.stop();
    logger.info({ workflowId }, 'Stopped cron job');
  }
  registeredJobs.clear();
}

export function getActiveJobCount(): number {
  return registeredJobs.size;
}