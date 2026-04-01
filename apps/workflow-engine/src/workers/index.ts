import { Worker, Job } from "bullmq";
import { getRedisConnection } from "@synchive/queue";
import { ExecutionJobData, JOB_NAMES } from "@synchive/queue";
import { createLogger } from "@synchive/logger";
import { executeWorkflow } from "../executor/workflow-executor";
import { config } from "../config";

const logger = createLogger({ service: "workflow-engine" });

let executionWorker: Worker | null = null;

export async function startWorkers(): Promise<void> {
  const connection = getRedisConnection();

  // Execution worker — processes top-level workflow executions
  executionWorker = new Worker(
    "workflow-execution", // must match the queue name in packages/queue
    async (job: Job<ExecutionJobData>) => {
      logger.info(
        {
          jobId: job.id,
          executionId: job.data.executionId,
          workflowId: job.data.workflowId,
        },
        "Processing workflow execution job"
      );

      await executeWorkflow(job.data);

      logger.info(
        {
          jobId: job.id,
          executionId: job.data.executionId,
        },
        "Workflow execution job completed"
      );
    },
    {
      connection,
      concurrency: config.maxConcurrency,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    }
  );

  // Worker event handlers
  executionWorker.on("failed", (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        executionId: job?.data?.executionId,
        error: err.message,
      },
      "Workflow execution job failed"
    );
  });

  executionWorker.on("error", (err) => {
    logger.error({ error: err.message }, "Execution worker error");
  });

  logger.info(
    { concurrency: config.maxConcurrency },
    "Execution worker started"
  );
}

export async function stopWorkers(): Promise<void> {
  if (executionWorker) {
    await executionWorker.close();
    logger.info("Execution worker stopped");
  }
}