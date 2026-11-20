import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Application,
  Review,
  StoreApp,
  StoreConnection,
  StoreSyncConfig,
} from '../../database/entities';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [CommonModule, 
    TypeOrmModule.forFeature([
      Application,
      StoreApp,
      StoreConnection,
      StoreSyncConfig,
      Review,
    ]),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
