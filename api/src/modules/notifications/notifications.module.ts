import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CredentialCryptoService } from '../../common/crypto/credential-crypto.service';
import {
  Application,
  NotificationChannel,
  NotificationOutbox,
  NotificationRule,
} from '../../database/entities';
import { NotificationSenderService } from './notification-sender.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [CommonModule, 
    TypeOrmModule.forFeature([
      NotificationChannel,
      NotificationRule,
      NotificationOutbox,
      Application,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationSenderService, CredentialCryptoService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
