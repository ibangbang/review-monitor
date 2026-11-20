export type ApiMeta = { requestId?: string; page?: number; pageSize?: number; total?: number };

export type Paginated<T> = { items: T[]; meta: ApiMeta };

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type WorkspaceSummary = {
  publicId: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  createdAt?: string;
};

export type MeResponse = {
  user: PublicUser;
  workspaces: WorkspaceSummary[];
};

export type StoreType = 'apple' | 'google' | 'huawei' | 'xiaomi' | 'oppo' | 'vivo' | 'mock';

export type StoreConnection = {
  id: string;
  storeType: StoreType;
  name: string;
  status: 'active' | 'invalid' | 'disabled';
  lastValidatedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  storeAppCount: number;
  createdAt: string;
  updatedAt?: string;
};

export type SyncConfig = {
  enabled: boolean;
  intervalMinutes: number;
  nextSyncAt: string | null;
  lastStartedAt: string | null;
  lastSyncedAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type PublicStoreApp = {
  id: string;
  applicationId: string;
  storeType: StoreType;
  externalAppId: string;
  countryCode: string;
  storeUrl: string | null;
  displayName: string | null;
  iconUrl: string | null;
  status: 'active' | 'paused' | 'archived';
  connection: { id: string; name: string; status: string } | null;
  sync: SyncConfig | null;
  reviewCount?: number;
  lastReviewAt?: string | null;
};

export type PublicApplication = {
  id: string;
  name: string;
  iconUrl: string | null;
  bundleId: string | null;
  packageName: string | null;
  description: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  storeAppCount: number;
  enabledStoreAppCount: number;
  lastSyncedAt: string | null;
  reviewCount: number;
  newReviews7d: number;
  averageRating: number | null;
  storeApps?: PublicStoreApp[];
};

export type ReviewStatus = 'unprocessed' | 'processing' | 'resolved' | 'ignored';

export type Review = {
  id: string;
  rating: number;
  title: string | null;
  contentExcerpt?: string;
  content?: string;
  authorName: string | null;
  countryCode: string | null;
  languageCode: string | null;
  appVersion: string | null;
  device: string | null;
  osVersion: string | null;
  sourceCreatedAt: string;
  sourceUpdatedAt: string | null;
  firstSeenAt: string;
  lastSyncedAt: string;
  developerReply: string | null;
  developerReplyAt: string | null;
  internalStatus: ReviewStatus;
  storeType: StoreType;
  externalReviewId: string;
  application: { id: string; name: string; iconUrl: string | null };
  storeApp: { id: string; externalAppId: string; storeUrl: string | null; displayName: string | null };
};

export type ReviewEvent = {
  id: string;
  eventType: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  source: string;
  createdAt: string;
};

export type ReviewNote = {
  id: string;
  content: string;
  author: { id: string | null; displayName: string | null };
  createdAt: string;
};

export type ReviewDetail = Review & {
  content: string;
  events: ReviewEvent[];
  notes: ReviewNote[];
};

export type NotificationChannel = {
  id: string;
  channelType: 'telegram' | 'webhook';
  name: string;
  enabled: boolean;
  configPreview: Record<string, unknown>;
  lastTestedAt: string | null;
  createdAt: string;
};

export type NotificationRule = {
  id: string;
  name: string;
  eventType: string;
  minRating: number | null;
  maxRating: number | null;
  applicationIds: string[] | null;
  channelIds: string[] | null;
  enabled: boolean;
  createdAt: string;
};

export type NotificationHistoryItem = {
  id: string;
  eventType: string;
  status: 'pending' | 'running' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  sentAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  payload: Record<string, unknown>;
  channel: { id: string; name: string; channelType: string } | null;
  createdAt: string;
};

export type AnalyticsOverview = {
  asOf: string;
  range: { from: string; to: string };
  scope: { applicationId: string | null };
  totals: {
    reviewCount: number;
    previousReviewCount: number;
    changePercent: number | null;
    lowRatingCount: number;
    lowRatingRatio: number;
    averageRating: number | null;
    pendingCount: number;
    applicationCount: number;
    storeAppCount: number;
    lastSyncedAt: string | null;
  };
};

export type TrendPoint = {
  bucket: string;
  reviewCount: number;
  averageRating: number | null;
  lowRatingCount: number;
};

export type DistributionBucket = {
  rating: number;
  reviewCount: number;
  ratio: number;
};

export type ApplicationComparison = {
  id: string;
  name: string;
  iconUrl: string | null;
  reviewCount: number;
  averageRating: number | null;
  lowRatingCount: number;
};

export type SyncHealthItem = {
  id: string;
  storeType: StoreType;
  externalAppId: string;
  status: string;
  application: { id: string; name: string };
  syncEnabled: boolean;
  intervalMinutes: number;
  lastSyncedAt: string | null;
  lastStartedAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastTaskStatus: string | null;
  lastTaskFinishedAt: string | null;
  freshnessMinutes: number | null;
  state: 'healthy' | 'delayed' | 'stale' | 'failing' | 'paused' | 'never';
};
