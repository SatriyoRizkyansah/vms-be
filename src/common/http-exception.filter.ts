import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiResponse } from './interface/api-response.interface';

@Catch()
export class HttpExceptionEnvelopeFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionEnvelopeFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : 500;

    let message = getExceptionMessage(exception);
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} failed with status ${statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      message = 'Internal server error';
    }

    const body: ApiResponse<null> = { statusCode, data: null, message };
    response.status(statusCode).json(body);
  }
}

function getExceptionMessage(exception: unknown) {
  if (exception instanceof HttpException) {
    const detail = exception.getResponse();
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && 'message' in detail) {
      const message = detail.message;
      if (Array.isArray(message)) return message.join('; ');
      if (typeof message === 'string') return message;
    }
    return exception.message;
  }

  return exception instanceof Error ? exception.message : 'Request failed';
}
