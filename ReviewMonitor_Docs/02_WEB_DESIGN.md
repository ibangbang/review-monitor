# ReviewMonitor Web 用户端设计方案

## 1. 定位与设计目标

Web 是面向独立开发者和小团队的主要产品界面。它不是传统企业管理后台，而是一款现代、轻量、可信赖的 SaaS 产品。

设计目标：
- 用户进入后快速知道有哪些新评价和需要处理的问题；
- 评价阅读体验优先，避免过度堆叠图表和指标；
- 添加应用、连接市场、开启监控的流程清晰；
- 数据新鲜度和采集健康状态透明；
- 视觉精致、克制，适合长期高频使用。

## 2. 技术栈

- React + Vite + TypeScript；
- Tailwind CSS；
- shadcn/ui；
- React Router；
- TanStack Query；
- TanStack Table；
- React Hook Form + Zod；
- Zustand（仅管理必要的客户端全局状态）；
- Lucide Icons；
- Recharts（基础统计图表）。

不建议为了 MVP 使用 Next.js。Web 是登录后为主的 SaaS 应用，业务数据由独立 NestJS API 提供，Vite SPA 更轻量。公开营销页如有 SEO 需求，可独立静态部署。

## 3. 视觉方向

关键词：
- Modern SaaS；
- Calm / Clear / Focused；
- Linear 风格的克制与信息层级；
- 内容优先，避免大面积渐变和装饰；
- 统一的间距、圆角、边框、阴影与状态色。

建议：
- 中性色作为基础；
- 蓝色或靛蓝作为主交互色；
- 红色仅用于差评、错误和风险；
- 绿色用于成功和健康状态；
- 黄色/橙色用于待处理和警告；
- 评分星星使用稳定的金黄色，但避免整页充满黄色。

避免：
- 传统后台模板式的大量彩色卡片；
- 每个区块都加边框；
- 过大的 KPI 数字；
- 无意义的装饰性图表；
- 用颜色作为唯一状态表达。

## 4. 信息架构与路由

建议路由：

```text
/login
/register
/forgot-password
/app
/app/overview
/app/reviews
/app/reviews/:reviewId
/app/applications
/app/applications/new
/app/applications/:applicationId
/app/stores
/app/stores/:connectionId
/app/notifications
/app/analytics
/app/settings/profile
/app/settings/workspace
/app/settings/security
```

主框架：
- 左侧主导航；
- 顶部 Workspace 切换器；
- 顶部搜索/快捷操作区域（可后续）；
- 右侧内容区域；
- 页面内容宽度适度，不要把阅读型评价详情拉得过宽。

## 5. 核心页面设计

### 5.1 Overview

目标：让用户在 5 秒内理解当前评价情况。

建议内容：
- 顶部标题与时间范围；
- 关键指标：新增评价、低星评价、平均采集样本评分、待处理数量；
- 最近评价列表；
- 应用/市场采集状态；
- 最近通知；
- 需要关注的异常提示。

数据卡片不要超过 4 个核心指标。明确显示数据范围与更新时间。

### 5.2 Reviews 评价中心

这是产品最重要的页面。

布局建议：
- 页面标题、评价总量；
- 搜索框；
- 过滤器：应用、市场、评分、处理状态、时间；
- 列表/表格主体；
- 右侧抽屉或独立详情页查看完整评价。

列表每行重点：
- 评分；
- 标题/正文摘要；
- 应用和市场；
- 版本；
- 时间；
- 内部处理状态。

交互：
- 点击行打开详情；
- 快速修改内部状态；
- 可添加内部备注；
- 支持排序和服务端分页；
- 空状态应引导用户添加应用或连接市场；
- 采集不完整时显示数据新鲜度提示。

### 5.3 Review Detail

详情页或侧边抽屉：
- 评分和评价正文；
- 来源市场、应用、国家/地区；
- 版本、设备、OS（仅平台提供时展示）；
- 评价创建和更新时间；
- 内部状态；
- 备注时间线；
- 官方回复信息独立展示。

### 5.4 Applications

应用列表采用简洁卡片或表格：
- 图标、应用名称、包名/Bundle ID；
- 已连接市场数量；
- 各市场监控状态；
- 最近同步时间；
- 新增评价数量。

新增流程：
1. 输入应用名称；
2. 选择市场；
3. 输入市场应用 ID / URL 或通过官方授权查询；
4. 绑定市场连接；
5. 测试连接；
6. 开启监控。

不要假设所有市场都支持自动搜索应用；需要提供手动填写市场 ID 的兜底方式。

### 5.5 Stores

市场连接列表：
- 市场名称；
- 授权状态；
- Workspace；
- 最近验证时间；
- 关联应用数；
- 错误状态。

授权表单按市场适配。Secret 输入框不回显已有值，只显示已配置状态。

### 5.6 Notifications

- 渠道配置：Telegram、Webhook；
- 规则配置：1–2 星即时通知、采集失败、授权失效；
- 测试发送；
- 通知历史和失败原因；
- 禁用渠道不删除历史记录。

### 5.7 Analytics

MVP 先提供轻量分析：
- 评价量趋势；
- 评分分布；
- 应用/市场对比；
- 版本反馈筛选。

必须区分“采集样本统计”和“平台官方总体评分”。如平台 API 返回范围有限，页面应明确说明。

## 6. 关键交互原则

- 所有异步操作显示 loading、成功和失败状态；
- 长耗时操作显示明确进度或“后台处理中”；
- 评价列表使用服务端分页；
- 筛选条件可保留在 URL query，方便刷新和分享；
- 删除、解绑、撤销授权等破坏性操作需要二次确认；
- 采集暂停与删除应用是不同操作；
- 表单错误贴近字段展示；
- 重要异常同时提供原因和下一步操作。

## 7. 响应式与未来移动端

MVP 以桌面 Web 为主要设计目标，同时保证平板和手机可访问：
- 桌面：完整侧边栏和表格；
- 平板：可折叠侧边栏；
- 手机：底部/抽屉导航，评价列表改为卡片；
- 不在手机上强行呈现宽表格。

未来 Flutter App 复用 API 和业务规则，不复用 Web UI 代码。

## 8. 前端工程建议

```text
apps/web/src/
  app/
  routes/
  components/
    layout/
    reviews/
    applications/
    stores/
    notifications/
    analytics/
  features/
  hooks/
  lib/
    api/
    auth/
    permissions/
    utils/
  styles/
  types/
```

约束：
- API 请求集中封装；
- 不在组件内散落 fetch；
- Query Key 统一管理；
- DTO 类型来自共享 contracts 或生成的 API Client；
- 业务组件不直接依赖后端数据库实体；
- 统一设计 token，避免页面各自定义颜色和间距。
