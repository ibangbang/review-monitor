import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace, WorkspaceMember } from '../database/entities';
import { WorkspaceGuard } from './guards/workspace.guard';
import { WorkspaceRolesGuard } from './guards/workspace-roles.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Workspace, WorkspaceMember])],
  providers: [WorkspaceGuard, WorkspaceRolesGuard],
  exports: [TypeOrmModule, WorkspaceGuard, WorkspaceRolesGuard],
})
export class CommonModule {}
