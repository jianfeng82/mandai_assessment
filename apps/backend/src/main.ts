import './core/otel/otel.setup'; // MUST BE ABSOLUTE FIRST IMPORT
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { loggerContext } from './common/logger/logger.context';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { ZodValidationFilter } from './core/filters/zod-validation.filter';

interface AuthenticatedRequest extends Request {
  user?: {
    userId?: string;
    email?: string;
    role?: string;
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const loggerService = app.get(LoggerService);
  app.useLogger(loggerService);

  // AsyncLocalStorage Request Context Middleware for correlation
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const userId =
      authReq.user?.userId ||
      (typeof req.headers['x-user-id'] === 'string'
        ? req.headers['x-user-id']
        : undefined);
    const requestId =
      typeof req.headers['x-request-id'] === 'string'
        ? req.headers['x-request-id']
        : undefined;
    loggerContext.run({ userId, requestId }, () => next());
  });

  // OWASP Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI assets
    }),
  );

  // Enable CORS for frontend and external tools
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, Idempotency-Key',
  });

  // Global Zod Validation Pipe
  app.useGlobalPipes(new ZodValidationPipe());

  // Global Exception Filters
  app.useGlobalFilters(
    new AllExceptionsFilter(loggerService),
    new ZodValidationFilter(loggerService),
  );

  // OpenAPI / Swagger Documentation with Zod Schema cleanup
  const config = new DocumentBuilder()
    .setTitle('Product Management & Concurrency API')
    .setDescription(
      'Enterprise API specification featuring role-based catalog management, atomic anti-overselling buy endpoint, idempotency, and inventory audit logs.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT access token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document));

  const port = process.env.PORT || 4000;
  await app.listen(port);
  loggerService.log(
    `Backend server is running on http://localhost:${port}`,
    'Bootstrap',
  );
  loggerService.log(
    `Swagger OpenAPI docs available at http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}
void bootstrap();
