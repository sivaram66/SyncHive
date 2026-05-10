# OpenTelemetry dependency installation

## packages/telemetry
cd packages/telemetry
npm install @opentelemetry/api

## apps/api-gateway
cd apps/api-gateway
npm install \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/sdk-trace-node \
  @opentelemetry/core \
  @synchive/telemetry

## apps/workflow-engine
cd apps/workflow-engine
npm install \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/sdk-trace-node \
  @opentelemetry/core \
  @synchive/telemetry

## packages/queue (needs @synchive/telemetry for injectContext)
cd packages/queue
npm install @synchive/telemetry