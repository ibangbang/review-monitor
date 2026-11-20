# ReviewMonitor CloudWorker

评价同步与通知发送的异步执行层。独立项目，不依赖根目录其他项目；通过 MySQL 与 API 共享数据（任务队列 + Outbox），不使用 Redis、常驻队列进程或 Docker。

## 运行模型

- **MySQL 即队列**：`review_tasks`、`notification_outbox` 是任务表，调度函数创建任务，工作函数以条件 UPDATE 原子领取（`status + locked_until`），失败按指数退避重试，租约过期由调度函数回收。
- **调度函数**（定时触发，建议每 1 分钟）：回收过期租约 → 扫描到期 `store_sync_configs` 并在同一事务内创建任务、推进 `next_sync_at` → 分发任务/通知（分发失败保持 pending，下次补偿）→ 归档清理。
- **评价工作函数**：事件体只接受 `{ taskId }`，自行领取任务、解密凭据、调用商店适配器、分页 upsert 评价、写 `review_events` 与 `notification_outbox`、成功后推进游标与同步配置。
- **通知工作函数**：事件体只接受 `{ outboxId }`，解密渠道配置、发送 Telegram / Webhook（HMAC 签名）、记录尝试。
- 适配器只做网络请求与数据归一化，**不访问数据库、不发通知**。当前实现 Apple App Store Connect、Google Play、华为应用市场与 mock（演示数据）。

## 目录

```
src/
  adapters/         商店适配器（apple / google / huawei / mock）与注册表
  config/env.ts     环境变量加载与校验
  crypto/           AES-256-GCM 凭据解密（与 API 加密格式一致）
  db/               mysql2 连接池、行类型
  functions/        云函数入口（scheduler / review-worker / notification-worker）
  notifications/    SSRF 校验、发送器、规则匹配与 outbox 生成
  services/         调度、评价同步、通知发送、函数分发
  utils/            日志（自动脱敏）、错误分类、退避、ID
  cli.ts            本地命令行入口
tests/              vitest 单测（加密、退避、规则、SSRF）
scripts/e2e-local.ts 本地端到端验证（需要 API 与 MySQL 在跑）
```

## 本地开发

```bash
pnpm install
cp .env.example .env   # 填入数据库与 CREDENTIAL_ENCRYPTION_KEY（必须与 API 相同）
pnpm typecheck
pnpm test
pnpm e2e               # 注册账号→创建应用→绑定 mock 商店→同步 24 条评价→低星通知送达本地 sink

pnpm scheduler         # 跑一次完整调度（分发默认在进程内联执行）
pnpm sync 5            # 批量消费到期任务
pnpm notify 20         # 批量消费待发送通知
pnpm review-worker <taskId>
pnpm notification-worker <outboxId>
pnpm dev serve 7070    # 本地内部 HTTP 入口（HMAC 校验 x-internal-timestamp/x-internal-signature）
```

`WORKER_TRIGGER_URL` / `NOTIFICATION_TRIGGER_URL` 为空时分发在进程内联执行（本地默认）；配置为云函数内网地址后改为 HTTP 分发，分发失败任务保持 pending 由下一轮调度补偿。

## 部署（火山引擎函数计算 FC）

每个入口单独一个函数，运行时 Node.js 20，构建产物为 `dist/`：

| 函数 | 入口 | 触发器 |
| --- | --- | --- |
| scheduler | `dist/functions/scheduler.handler.handler` | 定时触发器，1 分钟 |
| review-worker | `dist/functions/review-worker.handler.handler` | 异步调用（事件体 `{ taskId }`） |
| notification-worker | `dist/functions/notification-worker.handler.handler` | 异步调用（事件体 `{ outboxId }`） |

- 函数不暴露公网 HTTP 入口；函数间调用使用平台 IAM 或内网地址 + `INTERNAL_TRIGGER_SECRET` 签名。
- 函数超时时间必须小于 `WORKER_LOCK_SECONDS`（默认 300 秒），否则租约会提前失效导致重复执行。
- 连接池 `POOL_SIZE` 保持较小（默认 3），函数结束前释放连接；`WORKER_TIME_BUDGET_MS` 用于在超时前主动收尾并创建续跑任务。
- 凭据解密依赖 `CREDENTIAL_ENCRYPTION_KEY`，必须与 API 完全一致，建议放在 FC 环境变量/密钥管理，不写入代码库。

## 关键约束

- 评价唯一键 `(store_app_id, external_review_id)`；先按页批量 upsert，再写事件与 outbox，最后推进游标，保证幂等。
- outbox 去重键 `reviewPublicId:eventType:ruleId` + `UNIQUE(workspace_id, dedupe_key, channel_id)`，重复同步不会重复通知。
- 通知规则 `application_ids` / `channel_ids` 存的是内部数值 ID（API 对外用 publicId 转换）。
- Webhook 默认禁止内网/保留地址（含 DNS 解析结果），`ALLOW_PRIVATE_WEBHOOKS=true` 仅用于本地联调，生产保持 false。
- MySQL 8 中 `cursor` 是保留字，手写 SQL 需写成 `` `cursor` ``。
