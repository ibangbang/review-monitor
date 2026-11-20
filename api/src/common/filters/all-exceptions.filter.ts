import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import type { AppRequest } from '../types/request.types';

interface NormalizedError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<AppRequest>();
    const response = ctx.getResponse<Response>();
    const normalized = normalize(exception);

    if (normalized.status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${normalized.status} ${normalized.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(normalized.status).json({
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details !== undefined ? { details: normalized.details } : {}),
      },
      meta: { requestId: request.requestId ?? null },
    });
  }
}

function normalize(exception: unknown): NormalizedError {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return { status, code: defaultCode(status), message: body };
    }
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const rawMessage = record.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join('; ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : exception.message;
      return {
        status,
        code: typeof record.code === 'string' ? record.code : defaultCode(status),
        message,
        details: record.details ?? (Array.isArray(rawMessage) ? rawMessage : undefined),
      };
    }
    return { status, code: defaultCode(status), message: exception.message };
  }

  if (exception instanceof QueryFailedError) {
    const driverError = exception.driverError as { code?: string } | undefined;
    if (driverError?.code === 'ER_DUP_ENTRY') {
      return {
        status: HttpStatus.CONFLICT,
        code: 'RESOURCE_CONFLICT',
        message: 'Resource already exists',
      };
    }
    if (driverError?.code === 'ER_NO_REFERENCED_ROW_2') {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'INVALID_REFERENCE',
        message: 'Referenced resource does not exist',
      };
    }
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };
}

function defaultCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'AUTH_REQUIRED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE_ENTITY';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
  }
}
