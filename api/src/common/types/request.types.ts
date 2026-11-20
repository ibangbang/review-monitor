import type { AdminUser } from '../../database/entities/admin.entities';
import type { WorkspaceRole } from '../../database/entities/workspace.entities';

export interface AuthUser {
  id: string;
  publicId: string;
  email: string;
  displayName: string;
}

export interface WorkspaceContext {
  id: string;
  publicId: string;
  name: string;
  role: WorkspaceRole;
}

export interface AdminContext {
  id: string;
  publicId: string;
  email: string;
  displayName: string;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthUser;
      workspace?: WorkspaceContext;
      admin?: AdminContext;
    }
  }
}

export type AppRequest = import('express').Request & {
  requestId: string;
  user?: AuthUser;
  workspace?: WorkspaceContext;
  admin?: AdminContext;
};

export type AppAdmin = AdminUser;
