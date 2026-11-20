import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import {
  AdminSession,
  AdminUser,
  Application,
  AuditLog,
  NotificationChannel,
  NotificationOutbox,
  Review,
  ReviewTask,
  ReviewTaskAttempt,
  StoreApp,
  StoreConnection,
  StoreSyncConfig,
  User,
  Workspace,
  WorkspaceMember,
} from '../../database/entities';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminUser,
      AdminSession,
      AuditLog,
      User,
      Workspace,
      WorkspaceMember,
      Application,
      StoreApp,
      StoreConnection,
      StoreSyncConfig,
      Review,
      ReviewTask,
      ReviewTaskAttempt,
      NotificationChannel,
      NotificationOutbox,
    ]),
    AuthModule,
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminService, AdminAuthGuard],
})
export class AdminModule {}
