import { useQuery } from '@tanstack/react-query';
import { Card, Grid, Spin, Statistic, Tag, Typography } from '@arco-design/web-react';
import { fetchSystemHealth } from '@/lib/api/admin';
import { formatDateTime, formatUptime, fromNow } from '@/lib/format';

const { Row, Col } = Grid;

export function SystemHealthPage() {
  const query = useQuery({ queryKey: ['admin', 'health'], queryFn: fetchSystemHealth, refetchInterval: 30_000 });
  const data = query.data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>系统健康</h2>
          <p>
            数据来自 API 实时探测与数据库队列统计；函数平台自身指标请查看火山引擎监控控制台
            {data ? ` · 采集于 ${formatDateTime(data.asOf)}` : ''}
          </p>
        </div>
        <Tag color={data?.database.ok ? 'green' : 'red'}>
          {data?.database.ok ? `数据库正常 · ${data.database.latencyMs} ms` : '数据库异常'}
        </Tag>
      </div>

      {query.isLoading ? (
        <Spin style={{ display: 'block', margin: '80px auto' }} />
      ) : !data ? (
        <Card>健康数据加载失败</Card>
      ) : (
        <>
          <Row gutter={12}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="待执行任务" value={data.queue.pendingTasks} />
                <div className="muted">排队中的同步任务数量</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="租约超时任务"
                  value={data.queue.stuckTasks}
                  styleValue={{ color: data.queue.stuckTasks ? 'var(--color-danger-6)' : undefined }}
                />
                <div className="muted">running 但已超过 locked_until</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="24h 失败任务"
                  value={data.queue.failedTasks24h}
                  styleValue={{ color: data.queue.failedTasks24h ? 'var(--color-danger-6)' : undefined }}
                />
                <div className="muted">需要人工排查或重试</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="24h 失败通知"
                  value={data.notifications.failed24h}
                  styleValue={{ color: data.notifications.failed24h ? 'var(--color-danger-6)' : undefined }}
                />
                <div className="muted">Webhook / Telegram 投递失败</div>
              </Card>
            </Col>
          </Row>

          <Row gutter={12} style={{ marginTop: 12 }}>
            <Col span={12}>
              <Card title="采集状态">
                <div className="health-list">
                  <div>
                    <span>最近成功同步</span>
                    <span>
                      {data.sync.lastSyncedAt ? `${formatDateTime(data.sync.lastSyncedAt)}（${fromNow(data.sync.lastSyncedAt)}）` : '—'}
                    </span>
                  </div>
                  <div>
                    <span>启用中的同步配置</span>
                    <span>{data.sync.enabledConfigs}</span>
                  </div>
                  <div>
                    <span>待发送通知</span>
                    <span>{data.notifications.pending}</span>
                  </div>
                  <div>
                    <span>执行中任务</span>
                    <span>{data.queue.stuckTasks === 0 ? '无租约异常' : `${data.queue.stuckTasks} 个租约超时`}</span>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="运行时信息">
                <div className="health-list">
                  <div>
                    <span>API 进程运行时长</span>
                    <span>{formatUptime(data.process.uptimeSeconds)}</span>
                  </div>
                  <div>
                    <span>进程内存 (RSS)</span>
                    <span>{data.process.memoryRssMb} MB</span>
                  </div>
                  <div>
                    <span>Node.js 版本</span>
                    <span className="mono">{data.process.nodeVersion}</span>
                  </div>
                  <div>
                    <span>数据库探测</span>
                    <span>{data.database.ok ? `正常（${data.database.latencyMs} ms）` : '异常'}</span>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Card title="运维提示" style={{ marginTop: 12 }}>
            <Typography.Paragraph style={{ marginBottom: 6, fontSize: 13 }}>
              · Scheduler 每分钟由函数定时触发器执行，负责任务生成、过期租约回收与 Outbox 补偿；
            </Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: 6, fontSize: 13 }}>
              · Review Worker 与 Notification Worker 通过异步调用触发，事件体只包含内部 ID，不含凭据；
            </Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: 0, fontSize: 13 }}>
              · 若「租约超时任务」持续增长，说明 Worker 执行时间已接近或超过函数超时时间，请检查 WORKER_LOCK_SECONDS 与函数配置。
            </Typography.Paragraph>
          </Card>
        </>
      )}
    </div>
  );
}
