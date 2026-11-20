import { AdminSession, AdminUser, AuditLog } from './admin.entities';
import {
  NotificationAttempt,
  NotificationChannel,
  NotificationOutbox,
  NotificationRule,
} from './notification.entities';
import {
  Review,
  ReviewEvent,
  ReviewNote,
  ReviewTask,
  ReviewTaskAttempt,
} from './review.entities';
import { Application, StoreApp, StoreConnection, StoreSyncConfig } from './store.entities';
import { User, UserSession } from './user.entities';
import { Workspace, WorkspaceMember } from './workspace.entities';

export const ENTITIES = [
  User,
  UserSession,
  Workspace,
  WorkspaceMember,
  StoreConnection,
  Application,
  StoreApp,
  StoreSyncConfig,
  Review,
  ReviewEvent,
  ReviewNote,
  ReviewTask,
  ReviewTaskAttempt,
  NotificationChannel,
  NotificationRule,
  NotificationOutbox,
  NotificationAttempt,
  AdminUser,
  AdminSession,
  AuditLog,
];

export {
  User,
  UserSession,
  Workspace,
  WorkspaceMember,
  StoreConnection,
  Application,
  StoreApp,
  StoreSyncConfig,
  Review,
  ReviewEvent,
  ReviewNote,
  ReviewTask,
  ReviewTaskAttempt,
  NotificationChannel,
  NotificationRule,
  NotificationOutbox,
  NotificationAttempt,
  AdminUser,
  AdminSession,
  AuditLog,
};
