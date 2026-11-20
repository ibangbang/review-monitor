import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Application,
  Review,
  ReviewEvent,
  ReviewNote,
  StoreApp,
  User,
} from '../../database/entities';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [CommonModule, 
    TypeOrmModule.forFeature([Review, ReviewEvent, ReviewNote, Application, StoreApp, User]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
