import { logs } from '@opentelemetry/api-logs';
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';

const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
const isFargate = !!process.env.ECS_CONTAINER_METADATA_URI_V4;
const isLocalDev =
  nodeEnv === 'local' || (nodeEnv === 'development' && !isFargate);
const otelExplicitlyEnabled = process.env.OTEL_ENABLED === 'true';

// Initialize OpenTelemetry logging when in container/cloud or when OTEL_ENABLED is set
if (otelExplicitlyEnabled || !isLocalDev) {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const serviceName = process.env.OTEL_SERVICE_NAME || 'mandai-backend';

  const resource = resourceFromAttributes({
    'service.name': serviceName,
    'service.version': process.env.npm_package_version ?? '1.0.0',
    'deployment.environment': process.env.NODE_ENV || 'production',
    'fileexporter.path_segment': `${process.env.SERVER_NODE ?? 'backend-node-1'}/${dateStamp}`,
  });

  const exporterEndpoint =
    process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ||
    (process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`
      : 'http://localhost:4318/v1/logs');

  const exporter = new OTLPLogExporter({
    url: exporterEndpoint,
  });

  const loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor({ exporter })],
  });

  // Register globally so instrumentations attach
  logs.setGlobalLoggerProvider(loggerProvider);

  // Register Pino instrumentation which monkey-patches Pino to send logs via OTel
  registerInstrumentations({
    instrumentations: [new PinoInstrumentation()],
  });
}
