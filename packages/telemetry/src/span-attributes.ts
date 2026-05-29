/**
 * Shared span attribute key constants.
 *
 * Why constants instead of raw strings?
 * Typos in attribute names are a silent failure — spans get created but the
 * attribute is missing or mis-named, making queries in Jaeger/Honeycomb return
 * zero results. Constants give us compile-time safety and a single source of
 * truth across both services.
 *
 * We follow OTel semantic conventions where they exist (http.*, db.*) and
 * define our own namespace for SyncHive-specific attributes (synchive.*).
 */
export const SpanAttributes = {
  // SyncHive domain attributes
  WORKFLOW_ID: 'synchive.workflow.id',
  WORKFLOW_NAME: 'synchive.workflow.name',
  EXECUTION_ID: 'synchive.execution.id',
  EXECUTION_TRIGGER: 'synchive.execution.trigger',
  NODE_ID: 'synchive.node.id',
  NODE_TYPE: 'synchive.node.type',
  NODE_NAME: 'synchive.node.name',
  STEP_ATTEMPT: 'synchive.step.attempt',
  STEP_STATUS: 'synchive.step.status',
  VERSION_ID: 'synchive.version.id',
  WEBHOOK_PATH: 'synchive.webhook.path',

  // Job queue attributes
  JOB_ID: 'synchive.job.id',
  JOB_QUEUE: 'synchive.job.queue',
} as const;

export type SpanAttributeKey = (typeof SpanAttributes)[keyof typeof SpanAttributes];