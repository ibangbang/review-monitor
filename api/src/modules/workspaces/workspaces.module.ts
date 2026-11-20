import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Workspace, WorkspaceMember } from '../../database/entities';
import { WorkspacesController, WorkspaceDetailController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([Workspace, WorkspaceMember, User])],
  controllers: [WorkspacesController, WorkspaceDetailController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
