# ReviewMonitor Web

面向工作区成员的评论管理端。React 18 + Vite + TypeScript + Tailwind CSS，独立依赖、独立构建，不与其他项目共享任何代码。

## 开发

```bash
pnpm install
pnpm dev        # http://localhost:5160
pnpm typecheck
pnpm build      # 产物在 dist/
```

`pnpm dev` 会把 `/api` 代理到 `http://127.0.0.1:3060`（API 项目），可用 `VITE_API_PROXY` 覆盖。API 的 `WEB_ORIGIN` 必须与本端地址一致，否则写请求会被 CSRF 校验拒绝。

## 演示账号

`demo-ui@reviewmonitor.local`（密码见 API 项目 `.env` 的演示种子说明）。登录后可见「演示工作区」，内含两个应用与混排的 mock 商店评价。

## 页面

| 路由 | 说明 |
|---|---|
| `/login`、`/register`、`/forgot-password` | 认证；MVP 未开放邮件重置密码 |
| `/app/overview` | 30 天概览：新增评价、低星占比、平均分、待处理，异常提示与最近动态 |
| `/app/reviews` | 评价列表：关键词/状态/评分/商店/应用/排序 + 服务端分页，行内改状态 |
| `/app/reviews/:id` | 评价详情：正文、开发者回复、内部备注、处理轨迹 |
| `/app/applications` | 应用卡片列表、新建向导、详情（商店绑定、采集频率、凭据绑定、归档） |
| `/app/stores` | 商店连接：App Store / Google Play / 华为 / 演示商店，凭据录入与验证 |
| `/app/stores/:id` | 连接详情：验证、重命名、删除（解绑并暂停绑定） |
| `/app/notifications` | 通知渠道、规则、发送历史（含测试发送） |
| `/app/analytics` | 趋势（天/周）、评分分布、采集健康、应用对比 |
| `/app/settings/profile` · `workspace` · `security` | 个人资料、工作区与成员、会话与凭据安全说明 |

## 工程约定

- `src/lib/api/*`：所有请求经 `client.ts` 的 `request` / `requestList`，自动带 Cookie 与 `X-Workspace-Id`，解包 `{ data, meta }`；401 触发全局事件回到登录。
- 服务端状态用 TanStack Query，query key 统一在 `src/lib/queryKeys.ts`；工作区切换通过 `src/store/session.ts`（zustand，仅持久化 `activeWorkspaceId`）。
- UI 组件在 `src/components/ui`（Button/Dialog/Table/Toast 等，shadcn 风格但自建，无 shadcn 依赖）；不要引入 Arco 组件——那是 Dash 的体系。
- 认证依赖 HttpOnly Cookie，浏览器端不存储任何 token。
