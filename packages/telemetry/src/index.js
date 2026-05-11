"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trace = exports.context = exports.SpanKind = exports.SpanStatusCode = exports.SpanAttributes = exports.extractContext = exports.injectContext = exports.getTracer = void 0;
var tracer_1 = require("./tracer");
Object.defineProperty(exports, "getTracer", { enumerable: true, get: function () { return tracer_1.getTracer; } });
var propagation_1 = require("./propagation");
Object.defineProperty(exports, "injectContext", { enumerable: true, get: function () { return propagation_1.injectContext; } });
Object.defineProperty(exports, "extractContext", { enumerable: true, get: function () { return propagation_1.extractContext; } });
var span_attributes_1 = require("./span-attributes");
Object.defineProperty(exports, "SpanAttributes", { enumerable: true, get: function () { return span_attributes_1.SpanAttributes; } });
// Re-export the OTel API types that consumers will need for span manipulation
// This way services only need to install @opentelemetry/api themselves for SDK
// init — they get the types they need from this package for free.
var api_1 = require("@opentelemetry/api");
Object.defineProperty(exports, "SpanStatusCode", { enumerable: true, get: function () { return api_1.SpanStatusCode; } });
Object.defineProperty(exports, "SpanKind", { enumerable: true, get: function () { return api_1.SpanKind; } });
Object.defineProperty(exports, "context", { enumerable: true, get: function () { return api_1.context; } });
Object.defineProperty(exports, "trace", { enumerable: true, get: function () { return api_1.trace; } });
