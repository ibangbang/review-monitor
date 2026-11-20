import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { AppRequest } from '../types/request.types';

export interface PaginatedPayload<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RawPayload<T> {
  __raw: true;
  value: T;
}

export function rawResponse<T>(value: T): RawPayload<T> {
  return { __raw: true, value };
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    return next.handle().pipe(
      map((body: unknown) => {
        if (isRaw(body)) return body.value;
        const requestId = request.requestId ?? null;
        if (isPaginated(body)) {
          return {
            data: body.items,
            meta: {
              page: body.page,
              pageSize: body.pageSize,
              total: body.total,
              requestId,
            },
          };
        }
        return { data: body ?? null, meta: { requestId } };
      }),
    );
  }
}

function isPaginated(body: unknown): body is PaginatedPayload<unknown> {
  return (
    !!body &&
    typeof body === 'object' &&
    Array.isArray((body as PaginatedPayload<unknown>).items) &&
    typeof (body as PaginatedPayload<unknown>).total === 'number'
  );
}

function isRaw(body: unknown): body is RawPayload<unknown> {
  return !!body && typeof body === 'object' && (body as RawPayload<unknown>).__raw === true;
}
