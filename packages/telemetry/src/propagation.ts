import { context, propagation, Context } from '@opentelemetry/api';

/**
 * Trace context propagation helpers for BullMQ jobs.
 *
 * The problem: BullMQ is a queue, not an HTTP request. There are no headers to
 * carry the W3C TraceContext. If we don't manually carry the traceId + spanId
 * from the API gateway into the job, the engine will start a brand new trace
 * when it picks up the job — breaking the end-to-end trace.
 *
 * The solution: Serialize the current OTel context into a plain object when
 * producing a job, store it in the job's data, then deserialize it in the worker
 * before starting any spans. This is the standard pattern for async propagation.
 *
 * OTel's propagation API uses a "carrier" — any object with string key/value
 * pairs. We use a plain Record<string, string> as our carrier, which gets stored
 * in the BullMQ job data as `traceContext`.
 */

export type TraceCarrier = Record<string, string>;

/**
 * Captures the current active trace context into a plain object.
 * Call this in the API gateway just before pushing to BullMQ.
 */
export function injectContext(ctx: Context = context.active()): TraceCarrier {
  const carrier: TraceCarrier = {};
  propagation.inject(ctx, carrier);
  return carrier;
}

/**
 * Reconstructs an OTel Context from a previously injected carrier.
 * Call this in the BullMQ worker before starting spans.
 *
 * Returns the active context (unmodified) if the carrier is empty or missing —
 * this handles the case where a job was enqueued before OTel was set up,
 * or during local development without tracing enabled.
 */
export function extractContext(carrier: TraceCarrier | undefined): Context {
  if (!carrier || Object.keys(carrier).length === 0) {
    return context.active();
  }
  return propagation.extract(context.active(), carrier);
}