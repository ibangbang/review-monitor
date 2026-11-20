export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  requestId: string;
};

export type Paged<T> = { items: T[]; meta: PageMeta };

export type AdminProfile = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export type OverviewTotals = {
  users: number;
  activeUsers: number;
  workspaces: number;
  applications: number;
  storeApps: number;
  reviews: number;
  reviews24h: number;
  pendingTasks: number;
  runningTasks: number;
  failedTasks24h: number;
  pendingNotifications: number;
  failedNotifications24h: number;
  invalidConnections: number;
  lastSyncedAt: string | null;
};

export type Overview = { asOf: string; totals: OverviewTotals };

export type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  workspaceCount: number;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminWorkspace = {
  id: string;
  name: string;
  status: string;
  owner: { id: string | null; email: string | null; displayName: string | null } | null;
  applicationCount: number;
  reviewCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminApplication = {
  id: string;
  name: string;
  iconUrl: string | null;
  bundleId: string | null;
  packageName: string | null;
  status: string;
  workspace: { id: string; name: string } | null;
  storeApps: Array<{ id: string; storeType: string; externalAppId: string; status: string }>;
  reviewCount: number;
  averageRating: number | null;
  createdAt: string;
};

export type ReviewStatus = 'unprocessed' | 'processing' | 'resolved' | 'ignored';

export type AdminReview = {
  id: string;
  rating: number;
  title: string | null;
  contentExcerpt: string;
  storeType: string;
  internalStatus: ReviewStatus;
  countryCode: string | null;
  appVersion: string | null;
  sourceCreatedAt: string;
  application: { id: string; name: string } | null;
  workspace: { id: string; name: string } | null;
};

export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type TaskAttempt = {
  attemptNo: number;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  errorCode: string | null;
  errorMessage: string | null;
};

export type AdminTask = {
  id: string;
  taskType: string;
  status: TaskStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  nextRetryAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lockedUntil: string | null;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  workspace: { id: string; name: string } | null;
  application: { id: string; name: string } | null;
  storeApp: { id: string; storeType: string; externalAppId: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminTaskDetail = AdminTask & { attempts: TaskAttempt[] };

export type IntegrationSummary = {
  storeType: string;
  label: string;
  connections: number;
  active: number;
  invalid: number;
  storeApps: number;
};

export type IntegrationConnection = {
  id: string;
  storeType: string;
  name: string;
  status: string;
  workspace: { id: string; name: string } | null;
  lastValidatedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  storeAppCount: number;
  latestSyncError: { code: string | null; message: string | null; at: string | null } | null;
  createdAt: string;
};

export type Integrations = {
  asOf: string;
  summary: IntegrationSummary[];
  connections: IntegrationConnection[];
};

export type OutboxStatus = 'pending' | 'running' | 'sent' | 'failed' | 'cancelled';

export type AdminNotification = {
  id: string;
  eventType: string;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  sentAt: string | null;
  nextRetryAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  payload: {
    eventType?: string;
    title?: string;
    message?: string;
    rating?: number;
    ratingStars?: string;
    reviewId?: string;
    ruleName?: string;
    applicationName?: string;
    storeLabel?: string;
    authorName?: string;
    countryCode?: string;
    reviewTitle?: string;
    url?: string | null;
  } | null;
  channel: { id: string; name: string; channelType: string } | null;
  workspace: { id: string; name: string } | null;
  createdAt: string;
};

export type SystemHealth = {
  asOf: string;
  database: { ok: boolean; latencyMs: number };
  queue: { pendingTasks: number; stuckTasks: number; failedTasks24h: number };
  notifications: { pending: number; failed24h: number };
  sync: { lastSyncedAt: string | null; enabledConfigs: number };
  process: { uptimeSeconds: number; memoryRssMb: number; nodeVersion: string };
};

export type AuditLog = {
  id: string;
  actorType: 'admin' | 'user' | 'system';
  actor: { id: string | null; email: string | null; displayName: string | null } | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  beforeSummary: unknown;
  afterSummary: unknown;
  ip: string | null;
  createdAt: string;
};
