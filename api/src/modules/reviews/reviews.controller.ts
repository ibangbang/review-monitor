import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, CurrentWorkspace } from '../../common/decorators/current.decorators';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import type { AuthUser, WorkspaceContext } from '../../common/types/request.types';
import { CreateReviewNoteDto, ReviewQueryDto, UpdateReviewStatusDto } from './reviews.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
@UseGuards(WorkspaceGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  async list(@CurrentWorkspace() workspace: WorkspaceContext, @Query() query: ReviewQueryDto) {
    return this.reviews.list(workspace.id, query);
  }

  @Get(':id')
  async detail(@CurrentWorkspace() workspace: WorkspaceContext, @Param('id') id: string) {
    return this.reviews.detail(workspace.id, id);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviews.updateStatus(workspace.id, id, dto, user.id);
  }

  @Get(':id/events')
  async events(@CurrentWorkspace() workspace: WorkspaceContext, @Param('id') id: string) {
    return this.reviews.listEvents(workspace.id, id);
  }

  @Get(':id/notes')
  async notes(@CurrentWorkspace() workspace: WorkspaceContext, @Param('id') id: string) {
    return this.reviews.listNotes(workspace.id, id);
  }

  @Post(':id/notes')
  @HttpCode(201)
  async addNote(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateReviewNoteDto,
  ) {
    return this.reviews.addNote(workspace.id, id, dto, user);
  }
}
