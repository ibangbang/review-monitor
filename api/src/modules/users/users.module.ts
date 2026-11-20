import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [UsersController],
})
export class UsersModule {}
