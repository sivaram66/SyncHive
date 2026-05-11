"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTracer = getTracer;
var api_1 = require("@opentelemetry/api");
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
function getTracer(name, version) {
    if (version === void 0) { version = '1.0.0'; }
    return api_1.trace.getTracer(name, version);
}
