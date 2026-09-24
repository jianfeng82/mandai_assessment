import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Writable } from 'stream';
import pino from 'pino';
import { loggerContext } from './logger.context';

/** Keys to automatically mask in logs for security */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'authorization',
  'secret',
  'creditCard',
  '*.password',
  '*.token',
  '*.authorization',
  '*.secret',
  '*.creditCard',
];

/**
 * OpenTelemetry-Powered Logger Service
 *
 * In production/cloud/sidecar environments, Pino writes to a silent stream while
 * @opentelemetry/instrumentation-pino intercepts the log record in memory and
 * streams it asynchronously to the OpenTelemetry Collector sidecar (localhost:4318) via OTLP.
 * The sidecar handles centralized indexing, metrics extraction, and exports.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: pino.Logger;

  constructor(private configService: ConfigService) {
    const nodeEnv = (
      this.configService.get<string>('NODE_ENV', 'development') || 'development'
    ).toLowerCase();

    // AWS Fargate / Container environment detection
    const isFargate = !!process.env.ECS_CONTAINER_METADATA_URI_V4;
    const isLocalDev =
      nodeEnv === 'local' ||
      nodeEnv === 'test' ||
      (nodeEnv === 'development' && !isFargate);
    const otelExplicitlyEnabled = process.env.OTEL_ENABLED === 'true';

    let destination: pino.DestinationStream | NodeJS.WritableStream;

    if (isLocalDev && !otelExplicitlyEnabled) {
      // Local Dev (Developer Laptop): Pretty console output
      destination = pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      });
    } else if (process.env.OTEL_LOG_TO_CONSOLE === 'true') {
      destination = process.stdout;
    } else {
      // Production/Sidecar mode:
      // Route Pino output to a silent dummy destination so it does not pollute container stdout.
      // @opentelemetry/instrumentation-pino intercepts the log object in memory before it gets written here,
      // acting as our OTLP transport to the OpenTelemetry Collector sidecar.
      destination = new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      });
    }

    this.logger = pino(
      {
        level: this.configService.get<string>('LOG_LEVEL', 'info'),
        redact: {
          paths: SENSITIVE_KEYS,
          censor: '***MASKED***',
        },
        serializers: {
          req: pino.stdSerializers.req,
          res: pino.stdSerializers.res,
          err: pino.stdSerializers.err,
          error: pino.stdSerializers.err,
        },
      },
      destination,
    );
  }

  log(message: any, ...optionalParams: unknown[]) {
    this.callLogger('info', message, ...optionalParams);
  }

  error(message: any, ...optionalParams: unknown[]) {
    this.callLogger('error', message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: unknown[]) {
    this.callLogger('warn', message, ...optionalParams);
  }

  debug(message: any, ...optionalParams: unknown[]) {
    this.callLogger('debug', message, ...optionalParams);
  }

  verbose(message: any, ...optionalParams: unknown[]) {
    this.callLogger('trace', message, ...optionalParams);
  }

  private callLogger(
    level: pino.Level,
    message: any,
    ...optionalParams: unknown[]
  ) {
    let msg = '';
    let meta: Record<string, unknown> = {};
    let context = '';

    // 1. Safely dissect the incoming object
    if (typeof message === 'object' && message !== null) {
      if (message instanceof Error) {
        msg = message.message;
        meta.err = pino.stdSerializers.err(message);
      } else {
        const obj = message as Record<string, unknown>;
        msg =
          typeof obj.message === 'string' && obj.message !== ''
            ? obj.message
            : JSON.stringify(message);
        meta = {
          statusCode: obj.statusCode || obj.status,
          response: obj.response,
        };
      }
    } else {
      msg = String(message);
    }

    // 2. Parse optional context parameters
    if (optionalParams.length > 0) {
      const lastParam = optionalParams[optionalParams.length - 1];
      if (typeof lastParam === 'string') {
        context = lastParam;
        optionalParams.pop();
      }
    }

    // 3. Parse incoming error string logs safely
    if (level === 'error' && optionalParams.length > 0) {
      const firstParam = optionalParams[0];
      if (firstParam instanceof Error) {
        meta.err = pino.stdSerializers.err(firstParam);
        optionalParams.shift();
      } else if (typeof firstParam === 'string') {
        meta.err = pino.stdSerializers.err(new Error(firstParam));
        optionalParams.shift();
      }
    }

    if (optionalParams.length > 0) {
      Object.assign(meta, { data: optionalParams });
    }

    if (context) {
      meta.context = context;
    }

    const store = loggerContext.getStore();
    if (store && store.userId) {
      meta.userId = store.userId;
      msg = `[User:${store.userId}] ${msg}`;
    }

    // 4. Write safely to Pino
    try {
      this.logger[level](meta, msg);
    } catch (err) {
      console.error('LoggerService critical failure during writing:', err);
    }
  }
}
