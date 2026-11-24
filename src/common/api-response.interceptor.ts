import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import type { ApiResponse } from './interface/api-response.interface';

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((body: T) => {
        if (body instanceof StreamableFile || Buffer.isBuffer(body)) return body;

        const statusCode = response.statusCode;
        if (isApiResponse(body)) {
          return { ...body, statusCode } as ApiResponse<T>;
        }

        return {
          statusCode,
          data: body,
          message: getSuccessMessage(body),
        };
      }),
    );
  }
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<ApiResponse<unknown>>;
  return (
    typeof response.statusCode === 'number' &&
    'data' in response &&
    typeof response.message === 'string'
  );
}

function getSuccessMessage(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'message' in value &&
    typeof value.message === 'string'
  ) {
    return value.message;
  }
  return 'Berhasil';
}
