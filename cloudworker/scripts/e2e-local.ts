/**
 * 本地端到端验证脚本（非生产代码）
 * 1. 通过 API 注册用户 → 创建应用 → 绑定 mock 商店应用
 * 2. 直接写入一条指向本地 sink 的 webhook 渠道与低星通知规则（API 会拦截内网地址，故绕过）
 * 3. 运行一次调度：创建任务 → 同步 mock 评价 → 生成 outbox → 发送通知
 * 4. 校验评价、outbox、sink 接收结果，并验证幂等（重复调度不重复写评价/通知）
 *
 * 运行：pnpm e2e
 */
import { createServer } from 'node:http';
import { loadConfig } from '../src/config/env';
import { closePool, query } from '../src/db/mysql';
import { encryptCredential } from '../src/crypto/credential-crypto';
import { newPublicId } from '../src/utils/id';
import { schedulerService } from '../src/services/scheduler.service';
import type { RowDataPacket } from 'mysql2/promise';

const API = process.env.API_BASE_URL ?? 'http://127.0.0.1:3060/api/v1';
const SINK_PORT = Number(process.env.E2E_SINK_PORT ?? 8899);

const received: string[] = [];

function startSink(): Promise<import('node:http').Server> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      received.push(Buffer.concat(chunks).toString('utf8'));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  return new Promise((resolve) => server.listen(SINK_PORT, '127.0.0.1', () => resolve(server)));
}

type Session = { cookies: string[]; workspaceId: string };

async function api(
  session: Session | null,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown>; cookies: string[] }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (session) {
    headers['X-Workspace-Id'] = session.workspaceId;
    headers.cookie = session.cookies.join('; ');
  }
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const cookies = response.headers.getSetCookie().map((item) => item.split(';')[0] as string);
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  return { status: response.status, json, cookies };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const sink = await startSink();
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'E2ePassword123';

  const registered = await api(null, 'POST', '/auth/register', {
    email,
    password,
    displayName: 'E2E Runner',
    workspaceName: 'E2E Workspace',
  });
  if (registered.status !== 201 && registered.status !== 200) {
    throw new Error(`注册失败: ${registered.status} ${JSON.stringify(registered.json)}`);
  }
  const data = registered.json.data as Record<string, unknown>;
  const session: Session = {
    cookies: registered.cookies,
    workspaceId: String(data.workspacePublicId),
  };
  console.log('✓ 注册成功', { email, workspace: session.workspaceId });

  const app = await api(session, 'POST', '/applications', { name: 'E2E Mock App' });
  const appData = app.json.data as Record<string, unknown>;
  const applicationId = String(appData.id);
  console.log('✓ 创建应用', applicationId);

  const bound = await api(session, 'POST', `/applications/${applicationId}/store-apps`, {
    storeType: 'mock',
    externalAppId: `e2e-app-${Date.now()}`,
    countryCode: 'US',
    displayName: 'Mock Store App',
    intervalMinutes: 15,
  });
  if (bound.status >= 300) throw new Error(`绑定失败: ${JSON.stringify(bound.json)}`);
  const storeApp = (bound.json.data as Record<string, unknown>) as { id: number | string };
  const storeAppPublicId = String(storeApp.id);
  console.log('✓ 绑定 mock 商店应用', storeAppPublicId);

  const internal = await query<RowDataPacket & { id: string }>(
    'SELECT id FROM store_apps WHERE public_id = ? LIMIT 1',
    [storeAppPublicId],
  );
  const storeAppInternalId = String(internal[0]?.id);
  const appInternal = await query<RowDataPacket & { id: string }>(
    'SELECT id FROM applications WHERE public_id = ? LIMIT 1',
    [applicationId],
  );
  const applicationInternalId = String(appInternal[0]?.id);
  const workspaceInternal = await query<RowDataPacket & { id: string }>(
    'SELECT id FROM workspaces WHERE public_id = ? LIMIT 1',
    [session.workspaceId],
  );
  const workspaceInternalId = String(workspaceInternal[0]?.id);

  const channelPublicId = newPublicId();
  const channelConfig = encryptCredential(
    JSON.stringify({ url: `http://127.0.0.1:${SINK_PORT}/hook`, secret: 'e2e-secret' }),
    config.credential.encryptionKey,
  );
  await query(
    `INSERT INTO notification_channels
       (public_id, workspace_id, channel_type, name, config_ciphertext, config_key_version, enabled, created_at, updated_at)
     VALUES (?, ?, 'webhook', 'E2E Webhook', ?, 1, 1, NOW(6), NOW(6))`,
    [channelPublicId, workspaceInternalId, channelConfig],
  );
  const channelRow = await query<RowDataPacket & { id: string }>(
    'SELECT id FROM notification_channels WHERE public_id = ? LIMIT 1',
    [channelPublicId],
  );
  const channelInternalId = String(channelRow[0]?.id);

  await query(
    `INSERT INTO notification_rules
       (public_id, workspace_id, name, event_type, min_rating, max_rating, application_ids, channel_ids, enabled, created_at, updated_at)
     VALUES (?, ?, 'E2E 低星', 'review.created', 1, 2, ?, ?, 1, NOW(6), NOW(6))`,
    [newPublicId(), workspaceInternalId, JSON.stringify([Number(applicationInternalId)]), JSON.stringify([Number(channelInternalId)])],
  );
  console.log('✓ 渠道与低星规则已就绪');

  const first = await schedulerService.run();
  console.log('✓ 第一次调度', first);

  const reviewCount = await query<RowDataPacket & { count: number }>(
    'SELECT COUNT(*) AS count FROM reviews WHERE store_app_id = ?',
    [storeAppInternalId],
  );
  const eventCount = await query<RowDataPacket & { count: number }>(
    'SELECT COUNT(*) AS count FROM review_events e JOIN reviews r ON r.id = e.review_id WHERE r.store_app_id = ?',
    [storeAppInternalId],
  );
  const outboxRows = await query<RowDataPacket & { status: string; count: number }>(
    'SELECT status, COUNT(*) AS count FROM notification_outbox WHERE workspace_id = ? GROUP BY status',
    [workspaceInternalId],
  );
  console.log('  评价数量', Number(reviewCount[0]?.count), '事件数量', Number(eventCount[0]?.count));
  console.log('  outbox', outboxRows.map((row) => `${row.status}=${row.count}`).join(','));
  console.log('  sink 收到', received.length);

  if (Number(reviewCount[0]?.count) !== 24) throw new Error('评价数量应为 24');
  if (received.length === 0) throw new Error('通知未送达本地 sink');

  const second = await schedulerService.run();
  const reviewCount2 = await query<RowDataPacket & { count: number }>(
    'SELECT COUNT(*) AS count FROM reviews WHERE store_app_id = ?',
    [storeAppInternalId],
  );
  const outbox2 = await query<RowDataPacket & { count: number }>(
    'SELECT COUNT(*) AS count FROM notification_outbox WHERE workspace_id = ?',
    [workspaceInternalId],
  );
  console.log('✓ 第二次调度（幂等）', {
    createdTasks: second.createdTasks,
    reviews: Number(reviewCount2[0]?.count),
    outbox: Number(outbox2[0]?.count),
  });
  if (Number(reviewCount2[0]?.count) !== 24) throw new Error('重复调度不应新增评价');
  if (received.length !== Number(outbox2[0]?.count)) throw new Error('重复调度不应重复发送通知');

  await query('UPDATE store_sync_configs SET enabled = 0 WHERE store_app_id = ?', [storeAppInternalId]);
  sink.close();
  await closePool();
  console.log('✓ 端到端验证通过');
}

void main().catch(async (error: unknown) => {
  console.error('✗ 端到端验证失败:', (error as Error).message);
  await closePool().catch(() => undefined);
  process.exit(1);
});
