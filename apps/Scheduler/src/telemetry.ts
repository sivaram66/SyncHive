import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'scheduler',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),

  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'https://api.honeycomb.io/v1/traces',
        headers: {
          'x-honeycomb-team': process.env.HONEYCOMB_API_KEY ?? '',
        },
      })
    ),
  ],

  propagator: new W3CTraceContextPropagator(),

  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => sdk.shutdown().finally(() => process.exit(0)));
process.on('SIGINT', () => sdk.shutdown().finally(() => process.exit(0)));

export {};