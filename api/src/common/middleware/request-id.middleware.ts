import type { NextFunction, Response } from 'express';
import { ulid } from 'ulid';
import type { AppRequest } from '../types/request.types';

export function requestIdMiddleware(req: AppRequest, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.length <= 64 ? incoming : `req_${ulid()}`;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
