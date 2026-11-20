import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CredentialCryptoService } from '../../common/crypto/credential-crypto.service';
import { paginated } from '../../common/dto/pagination.dto';
import { DomainException } from '../../common/errors/domain.exception';
import { newPublicId } from '../../common/utils/id';
import {
  Application,
  NotificationChannel,
  NotificationOutbox,
  NotificationRule,
} from '../../database/entities';
import type { ChannelType } from '../../database/entities/notification.entities';
import {
  ChannelQueryDto,
  CreateChannelDto,
  CreateRuleDto,
  NotificationHistoryQueryDto,
  RuleQueryDto,
  UpdateChannelDto,
  UpdateRuleDto,
} from './notifications.dto';
import { NotificationSenderService } from './notification-sender.service';

const TELEGRAM_TOKEN_PATTERN = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;
const TELEGRAM_CHAT_PATTERN = /^(-?\d{1,20}|@[A-Za-z0-9_]{5,})$/;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationChannel)
    private readonly channels: Repository<NotificationChannel>,
    @InjectRepository(NotificationRule) private readonly rules: Repository<NotificationRule>,
    @InjectRepository(NotificationOutbox)
    private readonly outbox: Repository<NotificationOutbox>,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    private readonly crypto: CredentialCryptoService,
    private readonly sender: NotificationSenderService,
  ) {}

  async listChannels(workspaceId: string, query: ChannelQueryDto) {
    const where: Record<string, unknown> = { workspaceId };
    if (query.channelType) where.channelType = query.channelType;
    if (query.enabled !== undefined) where.enabled = query.enabled;
    const [rows, total] = await this.channels.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return paginated(rows.map((row) => this.toPublicChannel(row)), total, query.page, query.pageSize);
  }

  async createChannel(workspaceId: string, dto: CreateChannelDto) {
    await this.validateConfig(dto.channelType, dto.config);
    const channel = await this.channels.save(
      this.channels.create({
        publicId: newPublicId(),
        workspaceId,
        channelType: dto.channelType,
        name: dto.name.trim(),
        configCiphertext: this.crypto.encrypt(JSON.stringify(dto.config)),
        configKeyVersion: this.crypto.keyVersion,
        enabled: dto.enabled ?? true,
      }),
    );
    return this.toPublicChannel(channel);
  }

  async updateChannel(workspaceId: string, publicId: string, dto: UpdateChannelDto) {
    const channel = await this.findChannel(workspaceId, publicId);
    if (dto.config !== undefined) {
      await this.validateConfig(channel.channelType, dto.config);
      channel.configCiphertext = this.crypto.encrypt(JSON.stringify(dto.config));
      channel.configKeyVersion = this.crypto.keyVersion;
    }
    if (dto.name !== undefined) channel.name = dto.name.trim();
    if (dto.enabled !== undefined) channel.enabled = dto.enabled;
    await this.channels.save(channel);
    return this.toPublicChannel(channel);
  }

  async removeChannel(workspaceId: string, publicId: string): Promise<void> {
    const channel = await this.findChannel(workspaceId, publicId);
    await this.channels.delete({ id: channel.id });
    const rules = await this.rules.find({ where: { workspaceId } });
    for (const rule of rules) {
      if (rule.channelIds?.includes(channel.id)) {
        rule.channelIds = rule.channelIds.filter((id) => id !== channel.id);
        await this.rules.save(rule);
      }
    }
  }

  async testChannel(workspaceId: string, publicId: string) {
    const channel = await this.findChannel(workspaceId, publicId);
    const config = this.decryptConfig(channel);
    const result = await this.sender.send(config, {
      type: 'test',
      title: 'ReviewMonitor 测试通知',
      message: `通知渠道「${channel.name}」配置成功。`,
      sentAt: new Date().toISOString(),
    });
    channel.lastTestedAt = new Date();
    await this.channels.save(channel);
    return {
      success: result.success,
      statusCode: result.statusCode ?? null,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
      testedAt: channel.lastTestedAt,
    };
  }

  async listRules(workspaceId: string, query: RuleQueryDto) {
    const where: Record<string, unknown> = { workspaceId };
    if (query.eventType) where.eventType = query.eventType;
    if (query.enabled !== undefined) where.enabled = query.enabled;
    const [rows, total] = await this.rules.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    const [applications, channels] = await Promise.all([
      this.applications.find({ where: { workspaceId } }),
      this.channels.find({ where: { workspaceId } }),
    ]);
    const appById = new Map(applications.map((app) => [app.id, app]));
    const channelById = new Map(channels.map((channel) => [channel.id, channel]));
    return paginated(
      rows.map((rule) => this.toPublicRule(rule, appById, channelById)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async createRule(workspaceId: string, dto: CreateRuleDto) {
    const { applicationIds, channelIds } = await this.resolveRuleRefs(
      workspaceId,
      dto.applicationIds,
      dto.channelIds,
    );
    this.assertRatingRange(dto.minRating ?? null, dto.maxRating ?? null);
    const rule = await this.rules.save(
      this.rules.create({
        publicId: newPublicId(),
        workspaceId,
        name: dto.name.trim(),
        eventType: dto.eventType,
        minRating: dto.minRating ?? null,
        maxRating: dto.maxRating ?? null,
        applicationIds,
        channelIds,
        enabled: dto.enabled ?? true,
      }),
    );
    return this.ruleWithRefs(workspaceId, rule);
  }

  async updateRule(workspaceId: string, publicId: string, dto: UpdateRuleDto) {
    const rule = await this.findRule(workspaceId, publicId);
    if (dto.applicationIds !== undefined || dto.channelIds !== undefined) {
      const refs = await this.resolveRuleRefs(
        workspaceId,
        dto.applicationIds === undefined ? undefined : dto.applicationIds,
        dto.channelIds === undefined ? undefined : dto.channelIds,
      );
      if (dto.applicationIds !== undefined) rule.applicationIds = refs.applicationIds;
      if (dto.channelIds !== undefined) rule.channelIds = refs.channelIds;
    }
    if (dto.name !== undefined) rule.name = dto.name.trim();
    if (dto.eventType !== undefined) rule.eventType = dto.eventType;
    if (dto.minRating !== undefined) rule.minRating = dto.minRating;
    if (dto.maxRating !== undefined) rule.maxRating = dto.maxRating;
    if (dto.enabled !== undefined) rule.enabled = dto.enabled;
    this.assertRatingRange(rule.minRating, rule.maxRating);
    await this.rules.save(rule);
    return this.ruleWithRefs(workspaceId, rule);
  }

  async removeRule(workspaceId: string, publicId: string): Promise<void> {
    const rule = await this.findRule(workspaceId, publicId);
    await this.rules.delete({ id: rule.id });
  }

  async history(workspaceId: string, query: NotificationHistoryQueryDto) {
    const qb = this.outbox
      .createQueryBuilder('outbox')
      .where('outbox.workspace_id = :workspaceId', { workspaceId });
    if (query.status) qb.andWhere('outbox.status = :status', { status: query.status });
    if (query.eventType) qb.andWhere('outbox.event_type = :eventType', { eventType: query.eventType });
    if (query.channelId) {
      const channel = await this.findChannel(workspaceId, query.channelId);
      qb.andWhere('outbox.channel_id = :channelId', { channelId: channel.id });
    }
    qb.orderBy('outbox.created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    const channelIds = [...new Set(rows.map((row) => row.channelId))];
    const channels = channelIds.length
      ? await this.channels.find({ where: { id: In(channelIds) } })
      : [];
    const channelById = new Map(channels.map((channel) => [channel.id, channel]));
    return paginated(
      rows.map((row) => {
        const channel = channelById.get(row.channelId);
        return {
          id: row.publicId,
          eventType: row.eventType,
          status: row.status,
          attempts: row.attempts,
          maxAttempts: row.maxAttempts,
          nextRetryAt: row.nextRetryAt,
          sentAt: row.sentAt,
          errorCode: row.errorCode,
          errorMessage: row.errorMessage,
          payload: row.payload,
          channel: channel
            ? { id: channel.publicId, name: channel.name, channelType: channel.channelType, enabled: channel.enabled }
            : null,
          createdAt: row.createdAt,
        };
      }),
      total,
      query.page,
      query.pageSize,
    );
  }

  private async findChannel(workspaceId: string, publicId: string): Promise<NotificationChannel> {
    const channel = await this.channels.findOne({ where: { workspaceId, publicId } });
    if (!channel) {
      throw DomainException.notFound('NOTIFICATION_CHANNEL_NOT_FOUND', 'Notification channel not found');
    }
    return channel;
  }

  private async findRule(workspaceId: string, publicId: string): Promise<NotificationRule> {
    const rule = await this.rules.findOne({ where: { workspaceId, publicId } });
    if (!rule) {
      throw DomainException.notFound('NOTIFICATION_RULE_NOT_FOUND', 'Notification rule not found');
    }
    return rule;
  }

  private decryptConfig(channel: NotificationChannel): Record<string, unknown> {
    try {
      return JSON.parse(this.crypto.decrypt(channel.configCiphertext)) as Record<string, unknown>;
    } catch {
      throw DomainException.unprocessable(
        'CHANNEL_CONFIG_UNREADABLE',
        'Channel configuration could not be decrypted',
      );
    }
  }

  private async validateConfig(type: ChannelType, config: Record<string, unknown>): Promise<void> {
    if (type === 'telegram') {
      const botToken = config.botToken;
      const chatId = config.chatId;
      if (typeof botToken !== 'string' || !TELEGRAM_TOKEN_PATTERN.test(botToken)) {
        throw DomainException.badRequest('INVALID_TELEGRAM_TOKEN', 'botToken is not a valid Telegram bot token');
      }
      if (typeof chatId !== 'string' || !TELEGRAM_CHAT_PATTERN.test(chatId)) {
        throw DomainException.badRequest('INVALID_TELEGRAM_CHAT_ID', 'chatId must be a numeric id or @channel');
      }
      return;
    }
    if (type === 'webhook') {
      if (typeof config.url !== 'string') {
        throw DomainException.badRequest('INVALID_WEBHOOK_URL', 'url is required');
      }
      try {
        await this.sender.assertSafeUrl(config.url);
      } catch (error) {
        throw DomainException.badRequest(
          'INVALID_WEBHOOK_URL',
          error instanceof Error ? error.message : 'Invalid webhook URL',
        );
      }
      if (config.secret !== undefined && (typeof config.secret !== 'string' || config.secret.length > 256)) {
        throw DomainException.badRequest('INVALID_WEBHOOK_SECRET', 'secret must be a string up to 256 characters');
      }
      return;
    }
    throw DomainException.badRequest('UNSUPPORTED_CHANNEL_TYPE', 'Unsupported channel type');
  }

  private async resolveRuleRefs(
    workspaceId: string,
    applicationPublicIds?: string[] | null,
    channelPublicIds?: string[] | null,
  ): Promise<{ applicationIds: string[] | null; channelIds: string[] | null }> {
    let applicationIds: string[] | null = null;
    if (applicationPublicIds !== undefined) {
      if (!applicationPublicIds || applicationPublicIds.length === 0) {
        applicationIds = null;
      } else {
        const apps = await this.applications.find({
          where: { workspaceId, publicId: In(applicationPublicIds) },
        });
        if (apps.length !== new Set(applicationPublicIds).size) {
          throw DomainException.badRequest('INVALID_APPLICATION_REFERENCE', 'One or more applications were not found');
        }
        applicationIds = apps.map((app) => app.id);
      }
    }

    let channelIds: string[] | null = null;
    if (channelPublicIds !== undefined) {
      if (!channelPublicIds || channelPublicIds.length === 0) {
        channelIds = null;
      } else {
        const channels = await this.channels.find({
          where: { workspaceId, publicId: In(channelPublicIds) },
        });
        if (channels.length !== new Set(channelPublicIds).size) {
          throw DomainException.badRequest('INVALID_CHANNEL_REFERENCE', 'One or more channels were not found');
        }
        channelIds = channels.map((channel) => channel.id);
      }
    }
    return { applicationIds, channelIds };
  }

  private assertRatingRange(min: number | null, max: number | null): void {
    if (min !== null && max !== null && min > max) {
      throw DomainException.badRequest('INVALID_RATING_RANGE', 'minRating must not exceed maxRating');
    }
  }

  private async ruleWithRefs(workspaceId: string, rule: NotificationRule) {
    const [applications, channels] = await Promise.all([
      this.applications.find({ where: { workspaceId } }),
      this.channels.find({ where: { workspaceId } }),
    ]);
    return this.toPublicRule(
      rule,
      new Map(applications.map((app) => [app.id, app])),
      new Map(channels.map((channel) => [channel.id, channel])),
    );
  }

  private toPublicChannel(channel: NotificationChannel) {
    let preview: Record<string, unknown> = {};
    try {
      const config = JSON.parse(this.crypto.decrypt(channel.configCiphertext)) as Record<string, unknown>;
      if (channel.channelType === 'telegram') {
        const token = typeof config.botToken === 'string' ? config.botToken : '';
        preview = { chatId: config.chatId, botTokenMasked: token ? `••••${token.slice(-4)}` : null };
      } else {
        preview = { url: config.url, secretConfigured: Boolean(config.secret) };
      }
    } catch {
      preview = { unreadable: true };
    }
    return {
      id: channel.publicId,
      channelType: channel.channelType,
      name: channel.name,
      enabled: channel.enabled,
      lastTestedAt: channel.lastTestedAt,
      configPreview: preview,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    };
  }

  private toPublicRule(
    rule: NotificationRule,
    appById: Map<string, Application>,
    channelById: Map<string, NotificationChannel>,
  ) {
    return {
      id: rule.publicId,
      name: rule.name,
      eventType: rule.eventType,
      minRating: rule.minRating,
      maxRating: rule.maxRating,
      enabled: rule.enabled,
      applications: (rule.applicationIds ?? [])
        .map((id) => appById.get(id))
        .filter((app): app is Application => Boolean(app))
        .map((app) => ({ id: app.publicId, name: app.name })),
      channels: (rule.channelIds ?? [])
        .map((id) => channelById.get(id))
        .filter((channel): channel is NotificationChannel => Boolean(channel))
        .map((channel) => ({ id: channel.publicId, name: channel.name, channelType: channel.channelType })),
      matchesAllApplications: !rule.applicationIds?.length,
      matchesAllChannels: !rule.channelIds?.length,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
