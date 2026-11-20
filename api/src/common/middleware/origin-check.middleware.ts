import type { NextFunction, Response } from 'express';
import { DomainException } from '../errors/domain.exception';
import type { AppRequest } from '../types/request.types';

/**
 * CSRF hardening for cookie-based auth: state-changing requests must not come
 * from an unexpected browser Origin. Non-browser clients omit Origin entirely.
 */
export function originCheck(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins.filter(Boolean));
  return (req: AppRequest, _res: Response, next: NextFunction): void => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.header('origin');
    if (origin && !allowed.has(origin)) {
      throw DomainException.forbidden('CSRF_ORIGIN_REJECTED', 'Request origin is not allowed');
    }
    next();
  };
}
