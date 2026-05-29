export { getTracer } from './tracer';
export { injectContext, extractContext } from './propagation';
export { SpanAttributes } from './span-attributes';
export type { TraceCarrier } from './propagation';
export type { SpanAttributeKey } from './span-attributes';

// Re-export the OTel API types that consumers will need for span manipulation
// This way services only need to install @opentelemetry/api themselves for SDK
// init — they get the types they need from this package for free.
export {
  SpanStatusCode,
  SpanKind,
  context,
  trace,
} from '@opentelemetry/api';

export type { Span, Context, Tracer } from '@opentelemetry/api';