# ReviewMonitor 项目文档

> 临时产品名称：ReviewMonitor  
> 产品形态：Web SaaS + Dash + API + CloudWorker  
> 文档版本：0.1.0（MVP 规划基线）  
> 日期：2026-11-20

## 文档目录

| 文件 | 内容 |
|---|---|
| `01_PRODUCT_PRD.md` | 产品定位、用户、场景、功能需求、范围与验收 |
| `02_WEB_DESIGN.md` | 用户端 Web 的信息架构、交互与视觉设计方案 |
| `03_DASH_DESIGN.md` | Dash 管理运营端设计方案（Arco Design Pro） |
| `04_TECHNICAL_ARCHITECTURE.md` | 系统总体架构、部署、CloudWorker、可靠性与安全 |
| `05_DATABASE.md` | MySQL 数据模型与关键索引、约束 |
| `06_API_SPEC.md` | API 规范、认证、主要接口草案 |
| `07_MVP_PLAN.md` | 迭代计划、开发顺序、验收标准与风险清单 |

## 当前已确定的决策

- 名称暂定为 **ReviewMonitor**，后续如有更合适的品牌名再调整。
- 产品是公开注册的多租户 SaaS，首期先满足创建者自身使用，再逐步开放。
- 产品端由四个独立模块组成：**Web、Dash、API、CloudWorker**。
- Web 与 Dash 是两个独立前端项目、独立部署、独立设计体系。
- Web：React + Vite + TypeScript + Tailwind CSS + shadcn/ui。
- Dash：React + Vite + TypeScript + Arco Design Pro。
- API：NestJS + TypeORM + MySQL。
- CloudWorker：TypeScript，运行于火山引擎函数计算（Volcengine Function Compute）。
- 定时任务由火山引擎定时触发器唤起；MySQL 保存任务队列和任务状态。
- MVP 不引入 Redis、BullMQ、常驻 Worker、Kubernetes 或微服务。
- 通知采用独立 Outbox 记录与发送重试，避免通知失败影响评价采集。
- 所有用户业务数据从第一天起按 Workspace 隔离。
- 未来移动端可使用 Flutter，通过现有 API 接入；不改变云端采集架构。

## 文档使用说明

本套文档是可供 AI Coding Agent 使用的项目基线。接口路径、字段细节和平台授权方式在正式编码前仍需结合平台最新文档验证。尤其是 Apple、Google、华为及国内 Android 应用市场的 API 可用性、权限范围、速率限制和商业使用条款，必须先做接入验证。

遇到文档之间的冲突时，优先级为：
1. 用户明确确认的产品决策；
2. `04_TECHNICAL_ARCHITECTURE.md` 的架构约束；
3. `01_PRODUCT_PRD.md` 的产品范围；
4. 其他细化文档。
