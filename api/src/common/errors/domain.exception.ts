import { HttpException, HttpStatus } from '@nestjs/common';

export interface ErrorDetail {
  field?: string;
  message: string;
  [key: string]: unknown;
}

export class DomainException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: ErrorDetail[] | Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }

  static badRequest(code: string, message: string, details?: ErrorDetail[]) {
    return new DomainException(code, message, HttpStatus.BAD_REQUEST, details);
  }

  static unauthorized(code = 'AUTH_REQUIRED', message = 'Authentication required') {
    return new DomainException(code, message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(code: string, message: string) {
    return new DomainException(code, message, HttpStatus.FORBIDDEN);
  }

  static notFound(code: string, message: string) {
    return new DomainException(code, message, HttpStatus.NOT_FOUND);
  }

  static conflict(code: string, message: string) {
    return new DomainException(code, message, HttpStatus.CONFLICT);
  }

  static tooManyRequests(code = 'RATE_LIMITED', message = 'Too many requests') {
    return new DomainException(code, message, HttpStatus.TOO_MANY_REQUESTS);
  }

  static unprocessable(code: string, message: string) {
    return new DomainException(code, message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
