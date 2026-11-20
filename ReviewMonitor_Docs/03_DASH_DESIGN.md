# ReviewMonitor Dash 管理运营端设计方案

## 1. 定位

Dash 是 ReviewMonitor 内部使用的运营、管理和系统监控控制台，与 Web 用户端完全独立。

主要用户：
- 平台管理员；
- 开发/运维人员；
- 必要时的运营人员。

Dash 不是面向普通 SaaS 用户的评价工作台。普通用户的评价统计和应用管理属于 Web。

## 2. 技术栈

- React；
- Vite；
- TypeScript；
- Arco Design Pro；
- Arco Design 组件体系；
- 独立路由、权限和构建配置；
- 使用 API 提供的数据，不直接访问 MySQL。

Dash 与 Web 独立仓库或 Monorepo 子应用均可，但必须独立构建、独立部署、独立 UI 体系。不得混用 shadcn/ui 与 Arco Design 的组件样式。

## 3. 设计目标

- 高信息密度，适合排查问题；
- 任务、函数执行、平台 Adapter 和通知状态一目了然；
- 支持按时间、状态、平台、Workspace 检索；
- 管理操作有审计；
- 重要错误可追踪到具体任务和应用；
- 不以花哨视觉为目标，优先稳定、清晰和效率。

## 4. 信息架构

建议菜单：

1. Overview
2. Users
3. Workspaces
4. Applications
5. Reviews
6. Sync Tasks
7. Store Integrations
8. Notifications
9. System Health
10. Audit Logs

## 5. 页面设计

### 5.1 Overview

平台级运行概览：
- 注册用户数；
- Workspace 数；
- 已绑定应用数；
- 累计评价数；
- 最近 24 小时新增评价数；
- 待执行任务数；
- 失败任务数；
- 通知成功率；
- 最近函数执行异常。

指标应有时间范围和口径说明。

### 5.2 Users / Workspaces

- 用户搜索、状态、注册时间；
- Workspace 列表和成员数量；
- 用户与 Workspace 关联关系；
- 账号禁用/恢复（需审计）；
- 不允许管理员无痕查看用户凭证。

### 5.3 Applications

平台级应用和市场绑定视图：
- Workspace；
- Application；
- StoreApp；
- 市场；
- 监控状态；
- 最近成功同步；
- 最近错误。

### 5.4 Sync Tasks

这是 Dash 最重要的运维页面之一。

列表字段：
- task ID；
- Workspace；
- StoreApp；
- Market；
- status；
- attempts；
- scheduled_at；
- started_at；
- finished_at；
- duration；
- error code/message。

筛选：
- pending/running/succeeded/failed/cancelled；
- 市场；
- Workspace；
- 时间范围；
- 重试次数；
- 任务 ID。

详情：
- 任务输入摘要（不含 Secret）；
- 执行日志/步骤事件；
- 拉取数量、新增数量、更新数量；
- 错误堆栈（脱敏）；
- 重试历史。

管理员手动重试必须有权限并记录审计。

### 5.5 Store Integrations

- 每个 Adapter 的可用状态；
- API 错误分布；
- 授权失败次数；
- 429 限流情况；
- 平台请求耗时；
- 最近成功请求时间；
- 接口版本或 Adapter 版本。

### 5.6 Notifications

- Outbox 总量；
- pending/retrying/sent/failed；
- 渠道成功率；
- 失败原因；
- 手动重试；
- 重试操作审计。

### 5.7 System Health

展示：
- 最近定时触发时间；
- 最近 Scheduler 执行结果；
- pending 任务年龄；
- running 超出租约数量；
- 函数调用失败数；
- MySQL 连接和慢查询概况（若平台能安全提供）；
- 最近异常。

MVP 不要求 Dash 直接读取火山引擎内部监控数据库。可由 CloudWorker/API 写入执行记录，再由 Dash 查询；函数平台自身指标可通过平台监控控制台查看，后续再接入 API。

## 6. 权限与安全

- Dash 使用独立管理员角色；
- 不复用普通 Workspace 成员角色；
- 建议管理员账号启用强密码和 MFA（平台能力允许时）；
- 所有修改操作写入 audit_logs；
- 查看敏感配置时只展示脱敏摘要；
- 不提供凭证明文读取功能；
- 手动重试、禁用用户、修改平台配置等操作必须记录操作者、对象、前后值摘要和时间。

## 7. 前端工程建议

```text
apps/dash/src/
  pages/
  components/
  layouts/
  routes/
  services/
  hooks/
  store/
  utils/
  types/
```

优先使用 Arco Design Pro 已有的布局、表格、表单、图表和权限路由能力，避免重复造后台组件。
