# ReviewMonitor MySQL 数据库设计

## 1. 设计原则

- MySQL 作为 MVP 主数据库；
- 共享数据库、共享表，多租户逻辑隔离；
- 所有用户业务数据带 `workspace_id`，或可通过强约束关系追溯 Workspace；
- 评价使用市场外部 ID 去重；
- 任务表同时承担轻量队列和状态记录；
- 通知采用 Outbox；
- 时间统一以 UTC 存储，API 输出 ISO 8601；
- 金额/套餐等后续扩展，不在 MVP 引入复杂计费模型。

建议字符集 `utf8mb4`，InnoDB。主键可使用 BIGINT 自增（内部）或 UUID/ULID（对外 ID）；API 不暴露可枚举的敏感自增 ID 时应采用公开 ID。

## 2. 核心实体关系

```text
users ──< workspace_members >── workspaces
                                  │
                                  ├──< applications
                                  │       └──< store_apps
                                  │                ├── store_connections
                                  │                ├── store_sync_configs
                                  │                ├──< reviews
                                  │                └──< review_tasks
                                  │
                                  ├──< notification_channels
                                  ├──< notification_rules
                                  └──< audit_logs

reviews ──< review_events
reviews ──< review_notes

notification_outbox ──> notification_channels
```

## 3. 表清单

### 3.1 users

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT | 主键 |
| public_id | CHAR(26) | ULID/公开 ID，唯一 |
| email | VARCHAR(255) | 邮箱，唯一 |
| password_hash | VARCHAR(255) | 密码哈希 |
| display_name | VARCHAR(120) | 显示名称 |
| status | VARCHAR(20) | active/disabled/pending |
| email_verified_at | DATETIME | 验证时间 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 3.2 workspaces

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT | 主键 |
| public_id | CHAR(26) | 唯一公开 ID |
| name | VARCHAR(120) | Workspace 名称 |
| owner_user_id | BIGINT | Owner |
| status | VARCHAR(20) | active/suspended/deleted |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 3.3 workspace_members

- id；
- workspace_id；
- user_id；
- role（owner/admin/member）；
- status；
- joined_at；
- created_at；
- unique(workspace_id, user_id)。

MVP 可只开放 Owner 使用，但保留成员模型。

### 3.4 store_connections

市场授权连接。凭证加密保存。

- id；
- public_id；
- workspace_id；
- store_type（apple/google/huawei/xiaomi/oppo/vivo）；
- name；
- credential_ciphertext（LONGTEXT 或 JSON 加密密文）；
- credential_key_version；
- credential_fingerprint（用于识别是否更新，不可还原）；
- status（active/invalid/disabled）；
- last_validated_at；
- last_error_code；
- last_error_message（脱敏）；
- created_at；
- updated_at。

索引：`(workspace_id, store_type, status)`。

### 3.5 applications

用户逻辑应用。

- id；
- public_id；
- workspace_id；
- name；
- icon_url；
- bundle_id；
- package_name；
- description；
- status；
- created_at；
- updated_at。

索引：`(workspace_id, status)`。

### 3.6 store_apps

具体市场中的应用条目。

- id；
- public_id；
- workspace_id；
- application_id；
- store_connection_id；
- store_type；
- external_app_id；
- country_code；
- store_url；
- display_name；
- icon_url；
- status；
- created_at；
- updated_at。

唯一约束建议：`(store_type, store_connection_id, external_app_id, country_code)`，需根据各市场应用 ID 和地区语义调整。索引：`(workspace_id, application_id)`、`(workspace_id, store_type)`。

### 3.7 store_sync_configs

- id；
- workspace_id；
- store_app_id；
- enabled；
- interval_minutes；
- next_sync_at；
- last_started_at；
- last_synced_at；
- last_error_at；
- last_error_code；
- last_error_message；
- cursor（TEXT/JSON，按 Adapter 需要）；
- created_at；
- updated_at。

唯一约束：`store_app_id`。索引：`(enabled, next_sync_at)`、`(workspace_id, enabled)`。

### 3.8 reviews

- id；
- public_id；
- workspace_id；
- application_id；
- store_app_id；
- store_type；
- external_review_id；
- rating（DECIMAL 或 TINYINT，按平台标准化）；
- title；
- content（TEXT）；
- author_name；
- country_code；
- language_code；
- app_version；
- device；
- os_version；
- source_created_at；
- source_updated_at；
- developer_reply；
- developer_reply_at；
- internal_status（unprocessed/processing/resolved/ignored）；
- raw_data（JSON，可选，需隐私和保留策略）；
- first_seen_at；
- last_synced_at；
- created_at；
- updated_at。

唯一约束：`(store_app_id, external_review_id)`。

常用索引：
- `(workspace_id, source_created_at)`；
- `(workspace_id, internal_status, source_created_at)`；
- `(workspace_id, rating, source_created_at)`；
- `(workspace_id, application_id, source_created_at)`；
- `(store_app_id, source_created_at)`。

评价正文全文检索可先用 MySQL FULLTEXT；若后续搜索需求复杂再评估专用搜索引擎。

### 3.9 review_events

记录评价变化：
- id；
- workspace_id；
- review_id；
- event_type（created/updated/rating_changed/reply_updated/status_changed）；
- old_values（JSON）；
- new_values（JSON）；
- source；
- created_at。

索引：`(workspace_id, review_id, created_at)`。

### 3.10 review_notes

- id；
- workspace_id；
- review_id；
- user_id；
- content；
- created_at；
- updated_at。

索引：`(workspace_id, review_id, created_at)`。

### 3.11 review_tasks

- id；
- public_id；
- workspace_id；
- store_app_id；
- task_type（sync_reviews）；
- status（pending/running/succeeded/failed/cancelled）；
- priority；
- attempts；
- max_attempts；
- scheduled_at；
- next_retry_at；
- started_at；
- finished_at；
- locked_until；
- worker_request_id；
- fetched_count；
- inserted_count；
- updated_count；
- error_code；
- error_message；
- created_at；
- updated_at。

索引：
- `(status, scheduled_at)`；
- `(status, next_retry_at)`；
- `(status, locked_until)`；
- `(workspace_id, created_at)`；
- `(store_app_id, created_at)`。

建议增加 `review_task_attempts` 表保留每次执行尝试的开始时间、结束时间、错误和统计，避免主任务表只保留最后一次错误。

### 3.12 review_task_attempts

- id；
- task_id；
- attempt_no；
- function_request_id；
- status；
- started_at；
- finished_at；
- duration_ms；
- fetched_count；
- inserted_count；
- updated_count；
- error_code；
- error_message；
- created_at。

唯一约束：`(task_id, attempt_no)`。

### 3.13 notification_channels

- id；
- public_id；
- workspace_id；
- channel_type（telegram/webhook）；
- name；
- config_ciphertext；
- config_key_version；
- enabled；
- last_tested_at；
- created_at；
- updated_at。

### 3.14 notification_rules

- id；
- workspace_id；
- name；
- event_type；
- min_rating；
- max_rating；
- application_ids（初期 JSON 或后续关联表）；
- channel_ids（建议后续独立关联表）；
- enabled；
- created_at；
- updated_at。

### 3.15 notification_outbox

- id；
- public_id；
- workspace_id；
- channel_id；
- event_type；
- dedupe_key；
- payload（JSON）；
- status（pending/running/sent/failed/cancelled）；
- attempts；
- max_attempts；
- next_retry_at；
- locked_until；
- sent_at；
- error_code；
- error_message；
- created_at；
- updated_at。

唯一约束：`(workspace_id, dedupe_key, channel_id)`。索引：`(status, next_retry_at)`、`(status, locked_until)`。

### 3.16 notification_logs

可选。若 Outbox 已保留完整尝试信息，可使用 `notification_attempts` 取代重复日志表。推荐采用：
- notification_attempts：每次实际发送的结果；
- notification_outbox：当前状态和待发送内容。

### 3.17 admin_users / admin_sessions

Dash 管理员建议独立身份体系，MVP 可通过受控管理员账号表实现，不要把普通用户角色简单提升为平台管理员。

### 3.18 audit_logs

- id；
- admin_user_id 或 actor_user_id；
- actor_type；
- action；
- resource_type；
- resource_id；
- before_summary（JSON，脱敏）；
- after_summary（JSON，脱敏）；
- ip；
- user_agent；
- created_at。

索引：`(actor_type, created_at)`、`(resource_type, resource_id, created_at)`。

## 4. 任务状态与数据约束

- 任务状态转换必须受服务端控制；
- Worker 领取任务使用事务锁或条件更新；
- `locked_until` 过期可回收；
- 同步游标仅在完整成功后推进；
- 评价唯一约束确保重复拉取不会重复插入；
- Outbox dedupe key 确保通知幂等；
- 评价、事件、Outbox 尽量在同一数据库事务中提交。

## 5. 多租户隔离

所有 Repository 查询必须包含 Workspace 条件。推荐：
- API 从 JWT/session 中解析用户；
- 用户选择 Workspace 后，服务端验证成员关系；
- Service 方法显式接收已验证的 Workspace Context；
- 不信任客户端提交的 workspace_id；
- 管理员跨租户查询必须走独立 Admin Service 和审计。

## 6. 数据保留

MVP 暂不强制复杂保留策略，但应预留：
- 原始平台响应按需保留，避免无限增长；
- 函数执行明细可设置保留期限；
- 评价数据按套餐保留期限扩展；
- 删除 Workspace 时删除或匿名化用户数据，并清除加密凭证；
- 日志避免存储评价正文以外的敏感信息。
