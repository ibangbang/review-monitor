import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AppRequest } from '../types/request.types';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AppRequest>();
  return request.user;
});

export const CurrentWorkspace = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AppRequest>();
  return request.workspace;
});

export const CurrentAdmin = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AppRequest>();
  return request.admin;
});

export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AppRequest>().requestId;
});
