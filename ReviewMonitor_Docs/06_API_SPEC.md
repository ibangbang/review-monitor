# ReviewMonitor API 设计草案

## 1. 通用约定

- Base URL 示例：`https://api.example.com/v1`（正式域名待定）；
- JSON 请求与响应；
- UTF-8；
- 时间采用 ISO 8601 UTC；
- 金额如未来出现，使用最小货币单位或字符串；
- 统一分页；
- 所有错误使用稳定 `code`，前端不依赖错误文案做逻辑。

响应建议：

```json
{
  "data": {},
  "meta": {
    "requestId": "req_xxx"
  }
}
```

分页响应：

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 120,
    "requestId": "req_xxx"
  }
}
```

错误响应：

```json
{
  "error": {
    "code": "WORKSPACE_ACCESS_DENIED",
    "message": "You do not have access to this workspace"
  },
  "meta": {
    "requestId": "req_xxx"
  }
}
```

## 2. 认证

建议：
- Access Token 短期有效；
- Refresh Token 可撤销并轮换；
- Refresh Token 使用安全存储方式；
- Web 使用 HttpOnly、Secure、SameSite Cookie 优先；如采用 Bearer Token，需评估 XSS 风险；
- 移动端未来使用安全存储；
- Dash 独立管理员认证与权限。

## 3. 用户接口

| Method | Path | 说明 |
|---|---|---|
| POST | `/auth/register` | 注册 |
| POST | `/auth/login` | 登录 |
| POST | `/auth/refresh` | 刷新会话 |
| POST | `/auth/logout` | 退出 |
| GET | `/auth/me` | 当前用户 |
| GET | `/users/me` | 用户资料 |
| PATCH | `/users/me` | 修改资料 |

## 4. Workspace 接口

| Method | Path | 说明 |
|---|---|---|
| GET | `/workspaces` | 我的 Workspace |
| POST | `/workspaces` | 创建 Workspace |
| GET | `/workspaces/:id` | Workspace 详情 |
| PATCH | `/workspaces/:id` | 修改 Workspace |
| GET | `/workspaces/:id/members` | 成员列表 |
| POST | `/workspaces/:id/members` | 邀请成员（后续） |

所有 Workspace 业务接口必须验证当前用户成员身份。

## 5. 应用与市场接口

| Method | Path | 说明 |
|---|---|---|
| GET | `/applications` | 应用列表 |
| POST | `/applications` | 创建应用 |
| GET | `/applications/:id` | 应用详情 |
| PATCH | `/applications/:id` | 修改应用 |
| DELETE | `/applications/:id` | 删除/归档应用 |
| POST | `/applications/:id/store-apps` | 绑定市场条目 |
| GET | `/applications/:id/store-apps` | 市场条目列表 |
| PATCH | `/store-apps/:id` | 更新市场绑定 |
| DELETE | `/store-apps/:id` | 解绑市场条目 |
| GET | `/store-connections` | 市场连接列表 |
| POST | `/store-connections` | 创建市场连接 |
| POST | `/store-connections/:id/validate` | 测试授权 |
| PATCH | `/store-connections/:id` | 更新授权 |
| DELETE | `/store-connections/:id` | 删除授权 |

创建连接请求不得在响应中返回已保存的密钥明文。

## 6. 评价接口

| Method | Path | 说明 |
|---|---|---|
| GET | `/reviews` | 评价列表 |
| GET | `/reviews/:id` | 评价详情 |
| PATCH | `/reviews/:id/status` | 更新内部处理状态 |
| GET | `/reviews/:id/events` | 评价变化历史 |
| GET | `/reviews/:id/notes` | 内部备注列表 |
| POST | `/reviews/:id/notes` | 新增备注 |

`GET /reviews` 支持：
- `applicationId`
- `storeType`
- `rating`
- `status`
- `country`
- `appVersion`
- `keyword`
- `from`
- `to`
- `sort`
- `page`
- `pageSize`

所有筛选都必须限制在当前 Workspace 范围内。

## 7. 通知接口

| Method | Path | 说明 |
|---|---|---|
| GET | `/notification-channels` | 渠道列表 |
| POST | `/notification-channels` | 创建渠道 |
| PATCH | `/notification-channels/:id` | 修改渠道 |
| DELETE | `/notification-channels/:id` | 删除渠道 |
| POST | `/notification-channels/:id/test` | 测试发送 |
| GET | `/notification-rules` | 规则列表 |
| POST | `/notification-rules` | 创建规则 |
| PATCH | `/notification-rules/:id` | 修改规则 |
| GET | `/notification-history` | 通知历史 |

## 8. Analytics 接口

| Method | Path | 说明 |
|---|---|---|
| GET | `/analytics/overview` | 总览指标 |
| GET | `/analytics/reviews/trend` | 评价趋势 |
| GET | `/analytics/reviews/distribution` | 评分分布 |
| GET | `/analytics/applications/comparison` | 应用对比 |
| GET | `/analytics/sync-health` | 用户侧同步健康 |

响应必须带 `asOf` 或 `lastUpdatedAt`，并明确统计范围。

## 9. Dash Admin API

建议统一 `/admin/v1` 或 `/v1/admin` 前缀，独立 Guard。

| Method | Path | 说明 |
|---|---|---|
| POST | `/admin/auth/login` | 管理员登录 |
| GET | `/admin/overview` | 平台概览 |
| GET | `/admin/users` | 用户列表 |
| GET | `/admin/workspaces` | Workspace 列表 |
| GET | `/admin/applications` | 平台应用列表 |
| GET | `/admin/reviews` | 评价数据概览/排查 |
| GET | `/admin/review-tasks` | 任务列表 |
| GET | `/admin/review-tasks/:id` | 任务详情 |
| POST | `/admin/review-tasks/:id/retry` | 重试任务 |
| GET | `/admin/integrations` | Adapter 状态 |
| GET | `/admin/notifications` | 通知状态 |
| POST | `/admin/notifications/:id/retry` | 重试通知 |
| GET | `/admin/system-health` | 系统健康 |
| GET | `/admin/audit-logs` | 管理审计 |

所有 Admin 写操作必须有权限校验和审计日志。

## 10. CloudWorker 内部调用

CloudWorker 不应暴露公开的无鉴权 HTTP 入口。

可选调用方式：
- 函数计算异步调用参数只传 `task_id`；
- 函数间调用使用平台 IAM/服务身份；
- 如果通过 HTTP 内部入口，使用签名和时间戳防重放；
- 不在触发参数中传递 Secret。

内部函数入口示意：

```ts
type ReviewWorkerEvent = {
  taskId: string;
  requestId?: string;
};

type NotificationWorkerEvent = {
  outboxId: string;
  requestId?: string;
};
```

## 11. API 版本与兼容

- `/v1` 作为首个稳定版本；
- DTO 与数据库实体分离；
- 对外公开 ID 不使用可枚举主键；
- 新增可选字段尽量保持向后兼容；
- 破坏性变更通过新版本或明确迁移；
- API Client 类型可由 OpenAPI 生成并供 Web、Dash、未来 Mobile 使用。
