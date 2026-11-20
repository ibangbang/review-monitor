import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { paginated } from '../../common/dto/pagination.dto';
import { DomainException } from '../../common/errors/domain.exception';
import { newPublicId } from '../../common/utils/id';
import {
  Application,
  Review,
  ReviewEvent,
  ReviewNote,
  StoreApp,
  User,
} from '../../database/entities';
import {
  CreateReviewNoteDto,
  ReviewQueryDto,
  ReviewSort,
  UpdateReviewStatusDto,
} from './reviews.dto';

const EXCERPT_LENGTH = 280;

const SORT_SQL: Record<ReviewSort, [string, 'ASC' | 'DESC']> = {
  newest: ['r.source_created_at', 'DESC'],
  oldest: ['r.source_created_at', 'ASC'],
  rating_desc: ['r.rating', 'DESC'],
  rating_asc: ['r.rating', 'ASC'],
  updated: ['r.last_synced_at', 'DESC'],
};

export interface PublicReviewNote {
  id: string;
  content: string;
  author: { id: string; displayName: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicReviewEvent {
  id: string;
  eventType: string;
  oldValues: unknown;
  newValues: unknown;
  source: string;
  createdAt: Date;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(ReviewEvent) private readonly events: Repository<ReviewEvent>,
    @InjectRepository(ReviewNote) private readonly notes: Repository<ReviewNote>,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @InjectRepository(StoreApp) private readonly storeApps: Repository<StoreApp>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async list(workspaceId: string, query: ReviewQueryDto) {
    const qb = this.reviews
      .createQueryBuilder('r')
      .where('r.workspace_id = :workspaceId', { workspaceId });

    if (query.applicationId) {
      qb.innerJoin(Application, 'app', 'app.id = r.application_id').andWhere(
        'app.public_id = :applicationPublicId',
        { applicationPublicId: query.applicationId },
      );
    }
    if (query.storeType) qb.andWhere('r.store_type = :storeType', { storeType: query.storeType });
    if (query.rating !== undefined) qb.andWhere('r.rating = :rating', { rating: query.rating });
    if (query.status) qb.andWhere('r.internal_status = :status', { status: query.status });
    if (query.country) {
      qb.andWhere('r.country_code = :country', { country: query.country.toUpperCase() });
    }
    if (query.appVersion) qb.andWhere('r.app_version = :appVersion', { appVersion: query.appVersion });
    if (query.keyword) {
      qb.andWhere('(r.title LIKE :keyword OR r.content LIKE :keyword OR r.author_name LIKE :keyword)', {
        keyword: `%${query.keyword.trim()}%`,
      });
    }
    if (query.from) qb.andWhere('r.source_created_at >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('r.source_created_at <= :to', { to: new Date(query.to) });

    const [sortColumn, sortDirection] = SORT_SQL[query.sort ?? 'newest'];
    qb.orderBy(sortColumn, sortDirection).addOrderBy('r.id', 'DESC');
    qb.skip((query.page - 1) * query.pageSize).take(query.pageSize);

    const [rows, total] = await qb.getManyAndCount();
    const decorated = await this.decorate(rows);
    return paginated(decorated, total, query.page, query.pageSize);
  }

  async detail(workspaceId: string, publicId: string) {
    const review = await this.find(workspaceId, publicId);
    const [decorated] = await this.decorate([review]);
    const [events, notes] = await Promise.all([
      this.events.find({
        where: { workspaceId, reviewId: review.id },
        order: { createdAt: 'DESC' },
        take: 100,
      }),
      this.listNotes(workspaceId, publicId),
    ]);
    return {
      ...decorated,
      content: review.content,
      events: events.map((event) => this.toPublicEvent(event)),
      notes: notes.items,
    };
  }

  async updateStatus(
    workspaceId: string,
    publicId: string,
    dto: UpdateReviewStatusDto,
    actorUserId: string,
  ) {
    const review = await this.find(workspaceId, publicId);
    const previous = review.internalStatus;
    if (previous !== dto.status) {
      review.internalStatus = dto.status;
      await this.reviews.save(review);
      await this.events.save(
        this.events.create({
          publicId: newPublicId(),
          workspaceId,
          reviewId: review.id,
          eventType: 'status_changed',
          oldValues: { internalStatus: previous },
          newValues: { internalStatus: dto.status, actorUserId },
          source: 'user',
        }),
      );
    }
    const [decorated] = await this.decorate([review]);
    return { ...decorated, content: review.content };
  }

  async listEvents(workspaceId: string, publicId: string) {
    const review = await this.find(workspaceId, publicId);
    const events = await this.events.find({
      where: { workspaceId, reviewId: review.id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return events.map((event) => this.toPublicEvent(event));
  }

  async listNotes(workspaceId: string, publicId: string) {
    const review = await this.find(workspaceId, publicId);
    const notes = await this.notes.find({
      where: { workspaceId, reviewId: review.id },
      order: { createdAt: 'DESC' },
    });
    const userIds = [...new Set(notes.map((note) => note.userId))];
    const users = userIds.length ? await this.users.find({ where: { id: In(userIds) } }) : [];
    const userById = new Map(users.map((user) => [user.id, user]));
    return {
      items: notes.map((note) => {
        const user = userById.get(note.userId);
        return {
          id: note.publicId,
          content: note.content,
          author: user
            ? { id: user.publicId, displayName: user.displayName }
            : null,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        } satisfies PublicReviewNote;
      }),
      total: notes.length,
    };
  }

  async addNote(
    workspaceId: string,
    publicId: string,
    dto: CreateReviewNoteDto,
    user: { id: string; publicId: string; displayName: string | null },
  ): Promise<PublicReviewNote> {
    const review = await this.find(workspaceId, publicId);
    const note = await this.notes.save(
      this.notes.create({
        publicId: newPublicId(),
        workspaceId,
        reviewId: review.id,
        userId: user.id,
        content: dto.content.trim(),
      }),
    );
    return {
      id: note.publicId,
      content: note.content,
      author: { id: user.publicId, displayName: user.displayName },
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }

  async find(workspaceId: string, publicId: string): Promise<Review> {
    const review = await this.reviews.findOne({ where: { workspaceId, publicId } });
    if (!review) {
      throw DomainException.notFound('REVIEW_NOT_FOUND', 'Review not found');
    }
    return review;
  }

  private async decorate(rows: Review[]) {
    if (!rows.length) return [];
    const applicationIds = [...new Set(rows.map((row) => row.applicationId))];
    const storeAppIds = [...new Set(rows.map((row) => row.storeAppId))];
    const [applications, storeApps] = await Promise.all([
      this.applications.find({ where: { id: In(applicationIds) } }),
      this.storeApps.find({ where: { id: In(storeAppIds) } }),
    ]);
    const applicationById = new Map(applications.map((app) => [app.id, app]));
    const storeAppById = new Map(storeApps.map((app) => [app.id, app]));

    return rows.map((review) => {
      const application = applicationById.get(review.applicationId);
      const storeApp = storeAppById.get(review.storeAppId);
      const content = review.content ?? '';
      return {
        id: review.publicId,
        rating: review.rating,
        title: review.title,
        contentExcerpt:
          content.length > EXCERPT_LENGTH ? `${content.slice(0, EXCERPT_LENGTH)}…` : content,
        authorName: review.authorName,
        countryCode: review.countryCode,
        languageCode: review.languageCode,
        appVersion: review.appVersion,
        device: review.device,
        osVersion: review.osVersion,
        sourceCreatedAt: review.sourceCreatedAt,
        sourceUpdatedAt: review.sourceUpdatedAt,
        firstSeenAt: review.firstSeenAt,
        lastSyncedAt: review.lastSyncedAt,
        developerReply: review.developerReply,
        developerReplyAt: review.developerReplyAt,
        internalStatus: review.internalStatus,
        storeType: review.storeType,
        externalReviewId: review.externalReviewId,
        application: application
          ? {
              id: application.publicId,
              name: application.name,
              iconUrl: application.iconUrl,
            }
          : null,
        storeApp: storeApp
          ? {
              id: storeApp.publicId,
              externalAppId: storeApp.externalAppId,
              storeUrl: storeApp.storeUrl,
              displayName: storeApp.displayName,
            }
          : null,
      };
    });
  }

  private toPublicEvent(event: ReviewEvent): PublicReviewEvent {
    return {
      id: event.publicId,
      eventType: event.eventType,
      oldValues: event.oldValues,
      newValues: event.newValues,
      source: event.source,
      createdAt: event.createdAt,
    };
  }
}
