import { trace, Tracer } from '@opentelemetry/api';

/**
 * Returns a named tracer instance.
 *
 * Why a factory instead of a singleton tracer?
 * Each service (api-gateway, workflow-engine) registers itself under a different
 * instrumentation scope name. This shows up in Jaeger as the "library name" on
 * each span, making it immediately clear which service produced which span.
 *
 * Usage:
 *   import { getTracer } from '@synchive/telemetry';
 *   const tracer = getTracer('workflow-engine');
 *   tracer.startActiveSpan('execute-workflow', span => { ... });
 */
export function getTracer(name: string, version = '1.0.0'): Tracer {
  return trace.getTracer(name, version);
}