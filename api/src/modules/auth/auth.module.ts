import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  User,
  UserSession,
  Workspace,
  WorkspaceMember,
} from '../../database/entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserSession, Workspace, WorkspaceMember])],
  controllers: [AuthController],
  providers: [AuthService, TokenService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
