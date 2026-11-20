# ReviewMonitor 技术架构设计

## 1. 架构目标

- 前期以最低基础设施成本支持个人实际使用；
- 保留公开注册、多用户、多 Workspace 的 SaaS 能力；
- 采集任务云端运行，不依赖用户设备；
- 充分利用已有火山引擎函数计算、MySQL 和 Web 部署平台；
- MVP 不部署 Redis、BullMQ 或常驻 Worker；
- 模块边界清晰，未来可拆分和扩容。

## 2. 总体架构

```text
                 ┌──────────────────┐
                 │    Web Client    │
                 │ React + Vite     │
                 └────────┬─────────┘
                          │ HTTPS
                 ┌────────▼─────────┐
                 │    NestJS API    │
                 │ Auth / Business  │
                 └────────┬─────────┘
                          │
                          ▼
                    ┌──────────┐
                    │  MySQL   │
                    │ Business │
                    │ Task     │
                    │ Outbox   │
                    └────▲─────┘
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
┌──────┴──────┐  ┌───────┴──────┐  ┌──────┴──────┐
│ Dash Client │  │ Scheduler FC│  │ Worker FC   │
│ Arco Pro    │  │ Timer Trigger│  │ Task Invoke │
└──────┬──────┘  └──────────────┘  └──────┬──────┘
       │                                  │
       └────────────── API ───────────────┘
                                          │
                             ┌────────────▼───────────┐
                             │ Store Adapters         │
                             │ Apple / Google / Huawei│
                             │ Xiaomi / OPPO / vivo   │
                             └────────────┬───────────┘
                                          │
                                  Store APIs
                                          │
                             ┌────────────▼───────────┐
                             │ Notification Function  │
                             │ Telegram / Webhook     │
                             └────────────────────────┘
```

## 3. 四个独立模块

### 3.1 Web

- 独立前端项目和部署；
- 用户注册登录、Workspace、应用、市场连接、评价、通知和分析；
- 只通过 API 访问业务数据；
- 不包含采集逻辑和平台 Secret。

### 3.2 Dash

- 独立前端项目和部署；
- Arco Design Pro；
- 面向平台管理员；
- 查询用户、Workspace、应用、采集任务、通知和系统健康；
- 所有管理操作通过 API，并进行管理员鉴权和审计。

### 3.3 API

- NestJS 模块化单体；
- TypeORM；
- MySQL；
- 提供 Web、Dash、未来 Mobile 共用的业务 API；
- 负责认证、授权、Workspace 隔离、业务校验、数据查询和管理操作；
- 不承担长时间采集任务。

建议模块：
```text
src/
  auth/
  users/
  workspaces/
  applications/
  stores/
  reviews/
  review-notes/
  review-tasks/
  notifications/
  analytics/
  admin/
  audit/
  common/
```

### 3.4 CloudWorker

运行在火山引擎函数计算。TypeScript 实现，可按函数入口拆分部署，不需要常驻进程。

建议函数：
- `scheduler`：定时触发，扫描到期采集配置并创建任务；
- `review-worker`：执行一个 review sync task；
- `notification-worker`：发送一个通知 Outbox 任务；
- 可选 `recovery`：扫描超时任务和长期 pending 任务。MVP 可合并进 scheduler。

## 4. MySQL 任务队列设计

MySQL 作为 MVP 的任务状态事实来源和轻量队列。

### 4.1 Scheduler 流程

火山引擎定时触发器按固定周期调用 Scheduler，例如每 5 或 15 分钟。调度周期与每个 StoreApp 的采集间隔是两个不同概念。

Scheduler：
1. 查询 `enabled = true AND next_sync_at <= NOW()` 的同步配置；
2. 使用事务锁定候选记录，防止多个 Scheduler 并发重复创建；
3. 为每个到期 StoreApp 创建 `review_tasks`；
4. 更新 `next_sync_at`；
5. 提交事务；
6. 尝试异步调用 Worker；
7. 对分发失败任务保留 pending 状态，供后续补偿扫描。

重要：不要在创建任务前先推进游标或标记成功。创建任务和更新调度时间必须在同一数据库事务中完成。

### 4.2 Worker 流程

输入仅包含 `task_id`，不在函数调用参数中传递市场凭证。

1. 查询任务；
2. 使用原子条件更新或事务领取任务；
3. 只有 pending 或符合回收规则的任务可以领取；
4. 设置 running、started_at、locked_until；
5. 加载 StoreApp、Workspace 连接和加密凭证；
6. 解密凭证并调用对应 Adapter；
7. 标准化评价；
8. 批量 upsert 评价；
9. 写入 review_events；
10. 为符合规则的新评价写入 notification_outbox；
11. 同步成功后更新游标、同步配置和任务状态；
12. 失败时记录错误，按重试策略安排 next_retry_at 或标记 failed。

### 4.3 原子领取

建议事务中使用 `SELECT ... FOR UPDATE`；MySQL 版本支持时可使用 `SKIP LOCKED`。也可用条件更新实现领取，例如仅在 `status = 'pending'` 时更新为 running，并检查 affected rows。

不能仅执行普通 SELECT 后再 UPDATE，否则并发函数可能领取同一任务。

### 4.4 租约与恢复

- `locked_until` 表示任务租约截止时间；
- 函数超时或异常退出后，租约过期；
- Scheduler/Recovery 将租约过期的 running 任务重新放回 pending 或 retry 状态；
- 重新执行前必须保证评价写入和通知事件幂等；
- 租约时间应大于函数最大执行时间并留有缓冲。

### 4.5 重试

- 临时网络错误、429、5xx：指数退避并加入随机抖动；
- 凭证失效、权限不足、应用不存在等永久错误：不盲目高频重试，记录错误并要求用户处理；
- 达到最大次数后 failed；
- 手动重试必须创建新的尝试记录或清晰保留历史。

## 5. 通知 Outbox

评价采集和通知发送必须解耦。

Worker 在评价事务中写入 Outbox 事件；通知函数读取 Outbox 并发送。

流程：
1. 评价 upsert；
2. 生成 `review.created` 或 `review.updated` 事件；
3. 对满足规则的事件创建 notification_outbox；
4. 提交事务；
5. 异步调用 notification-worker；
6. 发送成功标记 sent；
7. 失败记录 attempts、error、next_retry_at；
8. Scheduler 补偿扫描待发送或租约过期的 Outbox。

通知去重键可由 review_id + event_type + rule/channel 组合生成唯一键。避免同一评价被重复采集时重复通知。

## 6. 平台 Adapter 架构

统一接口示意：

```ts
interface StoreReviewAdapter {
  validateConnection(input: ConnectionInput): Promise<ValidationResult>;
  fetchReviews(input: FetchReviewsInput): Promise<FetchReviewsResult>;
}

interface FetchReviewsInput {
  storeApp: StoreAppContext;
  credential: DecryptedCredential;
  cursor?: string | null;
  since?: Date | null;
  pageToken?: string | null;
}

interface FetchReviewsResult {
  reviews: NormalizedReview[];
  nextCursor?: string | null;
  hasMore: boolean;
  sourceSyncedAt: Date;
}
```

Adapter 职责：
- 调用官方接口；
- 处理认证和分页；
- 转换为统一评价结构；
- 归一化平台错误；
- 不直接操作业务数据库；
- 不直接发送通知；
- 不决定 Workspace 权限。

平台接入优先级：
1. Apple App Store Connect Customer Reviews API；
2. Google Play Developer Reviews API；
3. Huawei 官方评论接口（需验证权限、授权和数据范围）；
4. Xiaomi、OPPO、vivo：先做接口可行性和条款验证。

不得把逆向 API、抓包、模拟网页登录作为商业 SaaS 的基础方案。

## 7. 数据同步策略

- 每个 StoreApp 独立同步配置；
- 使用增量游标或时间窗口；
- 采用重叠窗口，覆盖延迟到达和更新；
- 外部评价 ID 唯一约束；
- 对平台可修改的评价进行 upsert；
- 只有完整成功后才推进游标；
- 对分页任务设置单次最大页数/执行时间，避免函数超时；
- 如果剩余分页较多，创建 continuation task，而不是无限执行。

## 8. 认证与安全

- API 使用短期 Access Token + Refresh Token（或可靠的会话方案）；
- 密码采用 Argon2id 或 bcrypt 安全参数哈希；
- Refresh Token 需要可撤销和轮换；
- Workspace 权限由服务端验证；
- Dash 使用独立管理员角色；
- Store 凭证使用应用层加密，密钥来自环境 Secret/KMS，不与数据库同库存储；
- 凭证字段使用 AES-256-GCM 等带认证加密方案；
- 密钥轮换要有版本标识；
- 日志、错误信息和 Dash 不得展示 Secret；
- Webhook 应验证签名/共享密钥；
- 管理操作写入审计日志；
- 限制注册、登录、Webhook 和敏感接口速率。

## 9. 部署建议

```text
Web Hosting
  └── web static build

Dash Hosting
  └── dash static build

API Hosting
  └── NestJS API service

Volcengine Function Compute
  ├── scheduler
  ├── review-worker
  └── notification-worker

MySQL
  ├── SaaS business data
  ├── review task queue
  └── notification outbox
```

Web 和 Dash 独立部署。API 可先部署在已有 Web/API 部署平台或现有服务器；CloudWorker 使用火山引擎函数计算。

## 10. 成本与容量控制

- 控制函数并发，避免平台限流；
- Worker 一次只处理一个 StoreApp 的一个同步任务；
- 批量写入评价；
- 减少每条评价单独查询；
- 函数数据库连接不要无限创建，合理设置连接池；
- 函数结束前释放连接；
- MySQL 连接数是 Serverless 架构的重点风险，需监控峰值；
- 初期按需执行，不预留常驻实例；
- 任务和日志设置保留期限与归档策略。

## 11. 未来演进

当任务量增长或 MySQL 队列成为瓶颈时，可将任务分发替换为云消息队列、Redis/BullMQ 等，但业务层保留：
- Adapter 接口；
- task 状态模型；
- 幂等业务逻辑；
- Outbox 事件模型。

未来移动端 Flutter 只新增客户端，通过同一 API 工作，不直接连接 MySQL，也不参与市场采集。
