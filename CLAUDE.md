# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目状态

MVP 已实现四个**完全独立**的项目，各自拥有独立的 `package.json`、`node_modules`、`.env` 与构建产物：

| 目录 | 技术栈 | 默认端口 |
|---|---|---|
| `api/` | NestJS 11 + TypeORM 0.3 + MySQL 8 | 3060（`/api/v1`） |
| `cloudworker/` | TypeScript（无框架），火山引擎函数计算入口 + CLI | 7070（仅本地内部触发验证） |
| `web/` | React 18 + Vite + TS + Tailwind（自建 shadcn 风格组件） | 5160 |
| `dash/` | React 18 + Vite + TS + Arco Design | 5161 |

没有 pnpm workspace、没有共享包、**不使用 Docker**（用户明确要求，优先于 `07_MVP_PLAN.md` 中"初始化 Monorepo"的表述）。跨项目共享的只有 MySQL 数据库与 `CREDENTIAL_ENCRYPTION_KEY`。

数据库：本机 MySQL（`127.0.0.1:3306`，库 `reviewmonitor`），`api` 负责 migration / seed，`cloudworker` 直接读写同一库。

## 常用命令

每个项目目录内单独执行（使用 pnpm）：

```bash
# api
pnpm install
pnpm start:dev                 # nest watch，:3060，Swagger 在 /api/docs
pnpm typecheck                 # 必须用它，见下方"工具链陷阱"
pnpm test                      # vitest（加密单测）
pnpm build && pnpm start
pnpm migration:generate src/database/migrations/<Name>
pnpm migration:run
pnpm seed                      # 创建 AdminUser；SEED_DEMO=true 时建演示账号

# cloudworker
pnpm install
pnpm typecheck && pnpm test    # vitest：加密往返、退避抖动、规则匹配、SSRF
pnpm build
pnpm dev                       # = ts-node src/cli.ts scheduler（跑一轮调度）
pnpm sync 5                    # 直接触发最多 5 个待执行任务
pnpm recover                   # 回收过期租约
pnpm serve                     # :7070 本地内部 HTTP 触发入口（需 INTERNAL_TRIGGER_SECRET）
pnpm e2e                       # 端到端：注册账号→绑 mock→调度→通知，写本地 sink

# web / dash
pnpm install
pnpm dev                       # web :5160；dash :5161（均 strictPort）
pnpm typecheck
pnpm build                     # tsc --noEmit && vite build
```

两端开发时 `/api` 由 Vite 代理到 `http://127.0.0.1:3060`（`VITE_API_PROXY` 可覆盖）。

## 运行配置要点

- `api/.env` 与 `cloudworker/.env` 的 `CREDENTIAL_ENCRYPTION_KEY` **必须一致**，否则 Worker 无法解密 API 写入的商店凭据。
- `DATABASE_TIMEZONE` 必须匹配 MySQL 会话时区（本机 `+08:00`；UTC 服务器用 `+00:00`）。配置错误会让 `createdAt` 与 `accessExpiresAt` 出现整小时偏移。
- `WEB_ORIGIN` / `DASH_ORIGIN` 是 CSRF Origin 白名单；新增前端端口必须同步修改，否则写请求返回 `CSRF_ORIGIN_REJECTED`。
- 演示账号：`demo-ui@reviewmonitor.local` / `demo12345`；管理员 `admin@reviewmonitor.local` / `af1d118f308728b3e15df740`。两个登录页在开发模式下已预填（`src/lib/test-accounts.ts`，`VITE_SHOW_TEST_ACCOUNTS=true` 可在生产构建中打开），正式上线前删除这些文件。
- 本地向 `127.0.0.1` webhook 发通知需 `cloudworker/.env` 的 `ALLOW_PRIVATE_WEBHOOKS=true`（生产必须关闭）。

## 架构总览

```text
定时触发器 → scheduler：扫描 enabled=1 AND next_sync_at<=NOW() 的 store_sync_configs
           → 同一事务内创建 review_tasks + 推进 next_sync_at（FOR UPDATE OF c SKIP LOCKED）
           → 异步调用 review-worker（只传 taskId）
review-worker：条件 UPDATE 原子领取 → 加载并解密凭据 → Store Adapter 拉取
             → 归一化 → 批量 upsert reviews → 写 review_events
             → 同事务写 notification_outbox（去重键 reviewPublicId:eventType:ruleId）
             → 完整成功才推进 cursor；分页超额时创建 continuation task
notification-worker：领取 outbox → 解密渠道配置 → Telegram/Webhook → sent / 指数退避重试
```

MySQL 同时承担业务数据、任务队列（`review_tasks`）和通知 Outbox。**不引入 Redis、BullMQ、常驻 Worker、Kubernetes 或微服务。**

## 不可违反的架构约束

- 多租户：用户业务数据都带 `workspace_id`；服务端从认证上下文解析并校验成员关系，**绝不信任客户端传入的 `workspace_id`**。Web 通过 `X-Workspace-Id` 头传递，API 用 `WorkspaceGuard` 校验；Admin 跨租户访问只能走 `AdminService` 并写 `audit_logs`。
- 任务领取必须原子：条件 UPDATE 并检查 `affectedRows === 1`（`cloudworker/src/services/review-sync.service.ts`），不能先 SELECT 再 UPDATE。
- 租约：`locked_until`（`WORKER_LOCK_SECONDS`，默认 300s）必须大于函数最大执行时间；过期 running 由 scheduler 回收。函数超时配置必须小于该值。
- 游标只在完整成功后推进；部分失败不得推进。`store_sync_configs.cursor` 是 MySQL 保留字，SQL 中必须写 `` `cursor` ``。
- 评价唯一键 `(store_app_id, external_review_id)`；Outbox 唯一键 `(workspace_id, dedupe_key, channel_id)`，重复采集不得重复通知。
- 通知与采集解耦：通知失败不回滚评价。
- 凭据：AES-256-GCM（格式 `v1.<iv>.<tag>.<ciphertext>`，base64url），带 `credential_key_version`；API 响应、日志、Dash 一律不返回明文；函数事件只传内部 ID。
- 平台接入只用官方 API（App Store Connect / Google Play / 华为），禁止逆向接口或模拟网页登录；xiaomi/oppo/vivo 暂未支持，创建连接会返回 `STORE_NOT_SUPPORTED`。
- 内部处理状态（`unprocessed/processing/resolved/ignored`）与商店官方开发者回复是两个独立概念。
- 统计口径：采集样本的平均分不等于平台官方总体评分，响应带 `asOf` 与范围说明。
- 时间统一 UTC 存储、API 输出 ISO 8601；对外用 ULID 公开 ID（`publicId`），不暴露自增主键。
- 外部 webhook URL 必须先过 SSRF 校验（`cloudworker/src/notifications/ssrf.ts` 与 `api/.../notification-sender.service.ts` 各有一份）。

## 数据模型要点

`users –< workspace_members >– workspaces –< applications –< store_apps`；`store_apps` 下挂 `store_connections`、`store_sync_configs`（唯一 `store_app_id`）、`reviews`、`review_tasks`。`reviews` 下挂 `review_events`、`review_notes`；通知侧为 `notification_channels`、`notification_rules`、`notification_outbox`（+`notification_attempts`）；平台侧为独立的 `admin_users` / `admin_sessions` 与 `audit_logs`。共 20 张表，实体在 `api/src/database/entities/`，迁移在 `api/src/database/migrations/`。

`review_tasks` 只保留最新错误，历史在 `review_task_attempts`（唯一 `(task_id, attempt_no)`）。`notification_rules.application_ids` / `channel_ids` 存内部数字 ID（NULL=全部），API 层与公开 ID 互转——Worker 直接按内部 ID 匹配。

## Adapter 契约

```ts
interface StoreReviewAdapter {
  validateConnection(credentials): Promise<ValidationResult>;
  fetchReviews(input: FetchReviewsInput): Promise<FetchReviewsResult>;
}
```

API 侧（`api/src/modules/stores/adapters/`）只做凭据校验；Worker 侧（`cloudworker/src/adapters/`）负责实际采集。Adapter 不碰业务数据库、不发通知、不判断 Workspace 权限。注册表：`adapterRegistry`。

## 接口约定

统一响应 `{ data, meta: { requestId } }`，分页 `meta` 带 `page/pageSize/total`；错误 `{ error: { code, message, details? }, meta }`，前端只依赖稳定的 `code`。认证用 HttpOnly Cookie（`rm_access` / `rm_refresh` / 管理员 `rm_admin`），刷新令牌轮换并检测重用。Admin 路由在 `/api/v1/admin` 下，控制器类级 `@Public()` 跳过全局 JWT Guard，由 `AdminAuthGuard` 校验 JWT + `admin_sessions` 活跃记录。

## 工具链陷阱（已踩过，勿重复）

- `pnpm exec tsc` 会解析到全局 TypeScript 5.0.2，对装饰器报假的 TS1238/1239/1240/1241，并让 `IsNull()` 等报"不可赋值"。**验证一律用 `pnpm typecheck`**；IDE 的单文件诊断（含 web/dash 的 `Cannot find module '@/...'`、`React refers to a UMD global`）同样是假阳性。
- 传给 `@UseGuards(GuardClass)` 的 Guard 在**宿主模块**的注入器中实例化：宿主模块必须能解析 Guard 的依赖。`CommonModule` 是 `@Global()` 且 `exports: [TypeOrmModule, WorkspaceGuard, WorkspaceRolesGuard]`；新增业务模块要 `imports: [CommonModule]`。
- `private readonly dataSource: import('typeorm').DataSource` 会擦除注入元数据导致启动报 `Nest can't resolve dependencies`，必须加 `@InjectDataSource()`。
- `nest start --watch` 崩溃后可能残留进程占用 3060（`EADDRINUSE`）且不再重编译：`lsof -ti :3060 | xargs -r kill -9; pkill -f "nest start"` 后重启，日志出现 `Nest application successfully started` 才算成功。
- mysql2 参数类型是 `SqlParam[]`（`string | number | Date | Buffer | null`），不能用 `unknown[]`；查询返回类型写 `query<RowDataPacket & {...}>`，不要写 `RowDataPacket[]`。
- 迁移生成后 `CreateDateColumn` 会变成 `datetime(6)` + `CURRENT_TIMESTAMP(6)`，属正常，无需重新生成。

## 文档地图与冲突优先级

| 文件 | 作用 |
|---|---|
| `ReviewMonitor_Docs/01_PRODUCT_PRD.md` | 产品范围、用户场景、功能需求、MVP 验收 |
| `ReviewMonitor_Docs/02_WEB_DESIGN.md` | Web 用户端信息架构、路由、交互与前端工程约束 |
| `ReviewMonitor_Docs/03_DASH_DESIGN.md` | Dash 管理端（Arco Design Pro）页面与权限 |
| `ReviewMonitor_Docs/04_TECHNICAL_ARCHITECTURE.md` | 系统架构、任务队列、Outbox、Adapter、安全、部署 |
| `ReviewMonitor_Docs/05_DATABASE.md` | 表结构、唯一约束、索引、多租户规则 |
| `ReviewMonitor_Docs/06_API_SPEC.md` | API 约定与接口草案 |
| `ReviewMonitor_Docs/07_MVP_PLAN.md` | 阶段划分、开发顺序、验收清单、风险 |

文档冲突时优先级：**用户明确确认的产品决策 > `04_TECHNICAL_ARCHITECTURE.md` 的架构约束 > `01_PRODUCT_PRD.md` 的产品范围 > 其他细化文档**。
