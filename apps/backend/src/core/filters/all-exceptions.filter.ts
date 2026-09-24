import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../../common/logger/logger.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BUSINESS_ERRORS } from '../../common/exceptions/business.exception.constants';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let httpStatus: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let internalCode: string = BUSINESS_ERRORS.INTERNAL_SERVER_ERROR.code;
    let message: string = BUSINESS_ERRORS.INTERNAL_SERVER_ERROR.message;

    if (exception instanceof BusinessException) {
      httpStatus = exception.getStatus();
      internalCode = exception.internalCode;
      message = exception.message;
      this.logger.warn(
        `[${request.method} ${request.url}] BusinessException: ${message} (Code: ${internalCode})`,
        'AllExceptionsFilter',
      );
    } else if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message =
          typeof resObj.message === 'string'
            ? resObj.message
            : JSON.stringify(resObj.message || exception.message);
        internalCode =
          typeof resObj.errorcode === 'string'
            ? resObj.errorcode
            : String(httpStatus);
      } else {
        message = exception.message;
      }
      this.logger.warn(
        `[${request.method} ${request.url}] HttpException ${httpStatus}: ${message}`,
        'AllExceptionsFilter',
      );
    } else {
      const err = exception as Error;
      message = err?.message || 'An unexpected error occurred';
      this.logger.error(
        `[${request.method} ${request.url}] Unhandled Exception: ${message}`,
        err?.stack,
        'AllExceptionsFilter',
      );
    }

    response.status(httpStatus).json({
      statusCode: httpStatus,
      errorcode: internalCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
