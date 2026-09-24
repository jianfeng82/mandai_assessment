import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { Request, Response } from 'express';
import { LoggerService } from '../../common/logger/logger.service';
import { BUSINESS_ERRORS } from '../../common/exceptions/business.exception.constants';

@Catch(ZodValidationException)
export class ZodValidationFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: ZodValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const zodError = exception.getZodError() as {
      issues?: Array<{ message: string; path: (string | number)[] }>;
    };
    const firstIssue = zodError.issues?.[0];
    const firstMessage = firstIssue
      ? `${firstIssue.path.join('.')}: ${firstIssue.message}`
      : 'Validation failed';

    this.logger.warn(
      `[${request.method} ${request.url}] ZodValidation Failure: ${firstMessage}`,
      'ZodValidationFilter',
    );

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      errorcode: BUSINESS_ERRORS.INVALID_INPUT.code,
      message: firstMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
