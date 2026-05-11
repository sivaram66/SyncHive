"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectContext = injectContext;
exports.extractContext = extractContext;
var api_1 = require("@opentelemetry/api");
/**
 * Captures the current active trace context into a plain object.
 * Call this in the API gateway just before pushing to BullMQ.
 */
function injectContext(ctx) {
    if (ctx === void 0) { ctx = api_1.context.active(); }
    var carrier = {};
    api_1.propagation.inject(ctx, carrier);
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
function extractContext(carrier) {
    if (!carrier || Object.keys(carrier).length === 0) {
        return api_1.context.active();
    }
    return api_1.propagation.extract(api_1.context.active(), carrier);
}
