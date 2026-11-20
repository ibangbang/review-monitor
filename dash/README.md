# ReviewMonitor Dash

平台管理端，面向运营/管理员，与 Web 用户端彻底分离（独立依赖、独立构建、独立会话 Cookie `rm_admin`）。

技术栈：React 18 + Vite 5 + TypeScript + Arco Design（`@arco-design/web-react`）+ TanStack Query + dayjs。**不要引入 Tailwind 或 Web 项目的组件**。

## 开发

```bash
pnpm install
pnpm dev        # http://localhost:5161（strictPort）
pnpm typecheck
pnpm build
```

`/api` 由 Vite 代理到 `http://127.0.0.1:3060`（可用 `VITE_API_PROXY` 覆盖）。API 项目的 `DASH_ORIGIN` 必须是 `http://localhost:5161`，否则写请求返回 `CSRF_ORIGIN_REJECTED`。

端口固定 5161 并开启 strictPort：静默换端口会导致 Origin 白名单失配，宁可当场报冲突。

## 管理员账号

`admin@reviewmonitor.local`，密码为 API 项目 `.env` 的 `ADMIN_PASSWORD`（由 `pnpm seed` 在 api 中创建）。开发模式下登录页已预填该账号并显示提示，直接点「登录」即可；生产构建默认不展示，需要时设 `VITE_SHOW_TEST_ACCOUNTS=true` 重新构建。

渲染期异常由 `src/components/error-boundary.tsx` 兜底，会显示错误信息而不是白屏。

## 页面

| 路由 | 说明 |
|---|---|
| `/login` | 管理员登录（独立会话，与用户端互不影响） |
| `/overview` | 9 项总量指标、最近失败任务与失败通知 |
| `/users` · `/workspaces` · `/applications` | 跨租户只读列表（关键词/状态筛选） |
| `/reviews` | 全平台评价检索（应用、工作区、商店、评分、状态、时间区间） |
| `/tasks` · `/tasks/:taskId` | 采集任务列表与详情：尝试历史、计数、错误，失败任务可重试 |
| `/integrations` | 各商店连接健康度汇总与逐个连接的最新同步错误 |
| `/notifications` | 通知 Outbox 记录、Payload 摘要、失败重试 |
| `/system-health` | 数据库延迟、队列积压/卡住任务、同步心跳、进程信息（30s 自动刷新） |
| `/audit-logs` | 管理员/用户/系统操作审计 |

## 权限与安全

- 所有请求带 Cookie（`rm_admin`），`AdminAuthGuard` 同时校验 JWT 与 `admin_sessions` 活跃记录；登出会吊销会话。前端不存储 token。
- 401/403 触发全局 `reviewmonitor-dash:unauthorized` 事件，`AdminGuard` 清理查询缓存并跳回登录。
- 所有管理操作在服务端写 `audit_logs`；前端不展示任何商店凭据或密钥。
