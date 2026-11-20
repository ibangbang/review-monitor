import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadConfig } from './config/env';
import { closePool, query } from './db/mysql';
import type { RowDataPacket } from 'mysql2/promise';
import { logger } from './utils/logger';
import { schedulerService } from './services/scheduler.service';
import { reviewSyncService } from './services/review-sync.service';
import { notificationService } from './services/notification.service';

type Mode =
  | 'scheduler'
  | 'review-worker'
  | 'notification-worker'
  | 'sync'
  | 'notify'
  | 'recover'
  | 'serve'
  | 'stats';

const USAGE = `用法: ts-node src/cli.ts <mode> [参数]
  scheduler                     执行一次调度（创建任务 + 分发 + 补偿 + 归档）
  review-worker <taskId>        执行单个同步任务（本地调试）
  notification-worker <outboxId> 执行单个通知发送（本地调试）
  sync [limit]                  批量消费到期 pending 任务
  notify [limit]                批量消费到期 pending 通知
  recover                       仅回收过期租约
  serve [port]                  启动本地内部 HTTP 入口（HMAC 签名校验）
  stats                         输出队列状态`;

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function verifySignature(secret: string, body: string, req: IncomingMessage): boolean {
  const timestamp = String(req.headers['x-internal-timestamp'] ?? '');
  const signature = String(req.headers['x-internal-signature'] ?? '');
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function startServer(port: number): Promise<void> {
  const config = loadConfig();
  const secret = config.worker.internalTriggerSecret;
  if (!secret) {
    logger.warn('未配置 INTERNAL_TRIGGER_SECRET，本地内部入口将拒绝所有请求');
  }

  const server = createServer(async (req, res) => {
    const rawBody = await readBody(req);
    if (!secret || !verifySignature(secret, rawBody, req)) {
      writeJson(res, 401, { ok: false, code: 'INTERNAL_SIGNATURE_INVALID' });
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      writeJson(res, 400, { ok: false, code: 'INVALID_JSON' });
      return;
    }
    try {
      if (req.url === '/internal/review-task' && payload.taskId) {
        const result = await reviewSyncService.runTask(String(payload.taskId), String(payload.requestId ?? 'http'));
        writeJson(res, 200, { ok: true, ...result });
        return;
      }
      if (req.url === '/internal/notification' && payload.outboxId) {
        const result = await notificationService.run(String(payload.outboxId), String(payload.requestId ?? 'http'));
        writeJson(res, 200, { ok: true, ...result });
        return;
      }
      writeJson(res, 404, { ok: false, code: 'NOT_FOUND' });
    } catch (error) {
      logger.error('内部入口执行失败', { url: req.url, message: (error as Error).message });
      writeJson(res, 500, { ok: false, code: 'INTERNAL_EXECUTION_FAILED' });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  logger.info('本地内部入口已启动', { port });

  const shutdown = () => {
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function main(): Promise<void> {
  const [mode, arg] = process.argv.slice(2) as [Mode | undefined, string | undefined];
  if (!mode) {
    console.log(USAGE);
    process.exit(1);
  }
  const config = loadConfig();

  try {
    switch (mode) {
      case 'scheduler': {
        const summary = await schedulerService.run();
        console.log(JSON.stringify(summary, null, 2));
        break;
      }
      case 'review-worker': {
        if (!arg) throw new Error('缺少 taskId');
        console.log(JSON.stringify(await reviewSyncService.runTask(arg, 'cli'), null, 2));
        break;
      }
      case 'notification-worker': {
        if (!arg) throw new Error('缺少 outboxId');
        console.log(JSON.stringify(await notificationService.run(arg, 'cli'), null, 2));
        break;
      }
      case 'sync': {
        const limit = Number(arg ?? config.worker.workerBatchSize);
        const ids = await schedulerService.duePendingTaskIds(limit);
        const results: unknown[] = [];
        for (const id of ids) results.push(await reviewSyncService.runTask(id, 'cli-sync'));
        console.log(JSON.stringify({ processed: results.length, results }, null, 2));
        break;
      }
      case 'notify': {
        const limit = Number(arg ?? config.worker.workerBatchSize * 4);
        const ids = await schedulerService.duePendingNotificationIds(limit);
        const results: unknown[] = [];
        for (const id of ids) results.push(await notificationService.run(id, 'cli-notify'));
        console.log(JSON.stringify({ processed: results.length, results }, null, 2));
        break;
      }
      case 'recover': {
        console.log(JSON.stringify(await schedulerService.recoverExpiredLeases(), null, 2));
        break;
      }
      case 'serve': {
        await startServer(Number(arg ?? process.env.WORKER_HTTP_PORT ?? 7070));
        return;
      }
      case 'stats': {
        const [tasks] = await query<RowDataPacket & { status?: string; count?: number; enabled?: number; nextDueAt?: Date | null }>(
          `SELECT status, COUNT(*) AS count FROM review_tasks GROUP BY status`,
        );
        const [outbox] = await query<RowDataPacket & { status?: string; count?: number; enabled?: number; nextDueAt?: Date | null }>(
          `SELECT status, COUNT(*) AS count FROM notification_outbox GROUP BY status`,
        );
        const [configs] = await query<RowDataPacket & { status?: string; count?: number; enabled?: number; nextDueAt?: Date | null }>(
          `SELECT COUNT(*) AS enabled, MIN(next_sync_at) AS nextDueAt FROM store_sync_configs WHERE enabled = 1`,
        );
        console.log(JSON.stringify({ tasks, outbox, configs }, null, 2));
        break;
      }
      default:
        console.log(USAGE);
        process.exit(1);
    }
  } finally {
    if (mode !== 'serve') await closePool();
  }
}

void main().catch((error: unknown) => {
  logger.error('CLI 执行失败', { message: (error as Error).message });
  process.exit(1);
});
