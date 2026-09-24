import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';
import { loggerContext } from './logger.context';

describe('LoggerService (OpenTelemetry + Pino)', () => {
  let logger: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: any) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'LOG_LEVEL') return 'debug';
              return defaultValue;
            },
          },
        },
      ],
    }).compile();

    logger = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should safely log string messages at different levels', () => {
    expect(() => {
      logger.log('Test info message', 'TestContext');
      logger.warn('Test warn message', 'TestContext');
      logger.debug('Test debug message', 'TestContext');
      logger.verbose('Test trace message', 'TestContext');
    }).not.toThrow();
  });

  it('should safely handle error instances and strings', () => {
    expect(() => {
      logger.error(
        'Error string occurred',
        'Stack trace string',
        'ErrorContext',
      );
      logger.error(new Error('Native error test'), 'ErrorContext');
      logger.error({ message: 'Custom error object', statusCode: 500 });
    }).not.toThrow();
  });

  it('should correlate logs with AsyncLocalStorage loggerContext', (done) => {
    loggerContext.run({ userId: 'usr-12345', requestId: 'req-abcde' }, () => {
      expect(() => {
        logger.log('Action performed by authenticated user');
      }).not.toThrow();
      done();
    });
  });

  it('should handle complex object serialization without breaking', () => {
    const complexPayload = {
      orderId: 'ord-999',
      metadata: { nested: true, items: [1, 2, 3] },
      password: 'super-secret-password-should-be-masked',
    };

    expect(() => {
      logger.log(complexPayload, 'OrderContext');
    }).not.toThrow();
  });
});
