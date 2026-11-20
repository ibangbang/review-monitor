import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_FILE = resolve(__dirname, '..', '..', '.env');
if (existsSync(ENV_FILE)) {
  dotenv.config({ path: ENV_FILE });
} else {
  dotenv.config();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`缺少必需的环境变量: ${name}`);
  }
  return value.trim();
}

function optional(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined ? fallback : value.trim();
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`环境变量 ${name} 必须是整数，当前值: ${raw}`);
  }
  return parsed;
}

export type AppConfig = {
  nodeEnv: string;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    timezone: string;
    poolSize: number;
  };
  credential: {
    encryptionKey: string;
    keyVersion: number;
  };
  worker: {
    lockSeconds: number;
    timeBudgetMs: number;
    syncPageSize: number;
    syncMaxPages: number;
    syncOverlapMinutes: number;
    schedulerBatchSize: number;
    workerBatchSize: number;
    retryBaseSeconds: number;
    retryMaxSeconds: number;
    taskRetentionDays: number;
    triggerUrl: string;
    notificationTriggerUrl: string;
    internalTriggerSecret: string;
  };
};

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  cached = {
    nodeEnv: optional('NODE_ENV', 'development'),
    database: {
      host: optional('DATABASE_HOST', '127.0.0.1'),
      port: int('DATABASE_PORT', 3306),
      user: optional('DATABASE_USER', 'root'),
      password: optional('DATABASE_PASSWORD', ''),
      name: optional('DATABASE_NAME', 'reviewmonitor'),
      timezone: optional('DATABASE_TIMEZONE', 'Z'),
      poolSize: int('DATABASE_POOL_SIZE', 3),
    },
    credential: {
      encryptionKey: required('CREDENTIAL_ENCRYPTION_KEY'),
      keyVersion: int('CREDENTIAL_KEY_VERSION', 1),
    },
    worker: {
      lockSeconds: int('WORKER_LOCK_SECONDS', 300),
      timeBudgetMs: int('WORKER_TIME_BUDGET_MS', 200000),
      syncPageSize: int('SYNC_PAGE_SIZE', 50),
      syncMaxPages: int('SYNC_MAX_PAGES', 20),
      syncOverlapMinutes: int('SYNC_OVERLAP_MINUTES', 30),
      schedulerBatchSize: int('SCHEDULER_BATCH_SIZE', 50),
      workerBatchSize: int('WORKER_BATCH_SIZE', 5),
      retryBaseSeconds: int('RETRY_BASE_SECONDS', 60),
      retryMaxSeconds: int('RETRY_MAX_SECONDS', 3600),
      taskRetentionDays: int('TASK_RETENTION_DAYS', 30),
      triggerUrl: optional('WORKER_TRIGGER_URL'),
      notificationTriggerUrl: optional('NOTIFICATION_TRIGGER_URL'),
      internalTriggerSecret: optional('INTERNAL_TRIGGER_SECRET'),
    },
  };
  return cached;
}
