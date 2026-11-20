import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Grid, Spin, Table, Tag, Typography } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { fetchNotifications, fetchOverview, fetchTasks } from '@/lib/api/admin';
import type { AdminNotification, AdminTask } from '@/types/admin';
import { formatDateTime, fromNow, OUTBOX_STATUS_META, TASK_STATUS_META, EVENT_TYPE_LABELS } from '@/lib/format';

const { Row, Col } = Grid;

export function OverviewPage() {
  const overviewQuery = useQuery({ queryKey: ['admin', 'overview'], queryFn: fetchOverview });
  const failedTasksQuery = useQuery({
    queryKey: ['admin', 'tasks', { status: 'failed', pageSize: 5 }],
    queryFn: () => fetchTasks({ status: 'failed', pageSize: 5 }),
  });
  const failedNotificationsQuery = useQuery({
    queryKey: ['admin', 'notifications', { status: 'failed', pageSize: 5 }],
    queryFn: () => fetchNotifications({ status: 'failed', pageSize: 5 }),
  });

  const totals = overviewQuery.data?.totals;

  const taskColumns: TableColumnProps<AdminTask>[] = [
    {
      title: '任务',
      dataIndex: 'id',
      render: (_, record) => (
        <Link className="mono" to={`/tasks/${record.id}`}>
          {record.id.slice(0, 10)}…
        </Link>
      ),
    },
    { title: '应用', render: (_, record) => record.application?.name ?? '—' },
    {
      title: '状态',
      render: (_, record) => {
        const meta = TASK_STATUS_META[record.status];
        return <Tag color={meta?.color}>{meta?.label ?? record.status}</Tag>;
      },
    },
    { title: '错误码', render: (_, record) => <span className="mono">{record.errorCode ?? '—'}</span> },
    { title: '发生时间', render: (_, record) => <span className="muted">{formatDateTime(record.finishedAt ?? record.updatedAt)}</span> },
  ];

  const notificationColumns: TableColumnProps<AdminNotification>[] = [
    {
      title: '事件',
      render: (_, record) => EVENT_TYPE_LABELS[record.eventType] ?? record.eventType,
    },
    { title: '应用', render: (_, record) => record.payload?.applicationName ?? '—' },
    { title: '渠道', render: (_, record) => record.channel?.name ?? '—' },
    {
      title: '状态',
      render: (_, record) => {
        const meta = OUTBOX_STATUS_META[record.status];
        return <Tag color={meta?.color}>{meta?.label ?? record.status}</Tag>;
      },
    },
    { title: '错误', render: (_, record) => <span className="mono">{record.errorCode ?? '—'}</span> },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>平台概览</h2>
          <p>
            统计口径：全平台累计数据；24 小时指标以 API 服务器当前时间为基准
            {overviewQuery.data ? ` · 采集于 ${formatDateTime(overviewQuery.data.asOf)}` : ''}
          </p>
        </div>
        <Tag color={overviewQuery.data?.totals.invalidConnections ? 'red' : 'green'}>
          {overviewQuery.data?.totals.invalidConnections
            ? `${overviewQuery.data.totals.invalidConnections} 个商店连接已失效`
            : '商店连接正常'}
        </Tag>
      </div>

      {overviewQuery.isLoading ? (
        <Spin style={{ display: 'block', margin: '80px auto' }} />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard title="注册用户" value={totals?.users ?? 0} suffix={`活跃 ${totals?.activeUsers ?? 0}`} />
            <StatCard title="工作区" value={totals?.workspaces ?? 0} />
            <StatCard title="应用" value={totals?.applications ?? 0} suffix={`绑定 ${totals?.storeApps ?? 0} 个商店应用`} />
            <StatCard title="累计评价" value={totals?.reviews ?? 0} />
            <StatCard title="近 24h 新增评价" value={totals?.reviews24h ?? 0} />
            <StatCard title="待执行任务" value={totals?.pendingTasks ?? 0} suffix={`执行中 ${totals?.runningTasks ?? 0}`} accent={totals?.pendingTasks ? 'orange' : undefined} />
            <StatCard title="24h 失败任务" value={totals?.failedTasks24h ?? 0} accent={totals?.failedTasks24h ? 'red' : undefined} />
            <StatCard
              title="通知积压"
              value={totals?.pendingNotifications ?? 0}
              suffix={`24h 失败 ${totals?.failedNotifications24h ?? 0}`}
              accent={totals?.failedNotifications24h ? 'red' : undefined}
            />
            <StatCard title="最近同步" value={totals?.lastSyncedAt ? fromNow(totals.lastSyncedAt) : '—'} suffix={formatDateTime(totals?.lastSyncedAt)} />
          </div>

          <Row gutter={12} style={{ marginTop: 12 }}>
            <Col span={12}>
              <Card
                title="最近失败任务"
                extra={<Link to="/tasks">查看全部</Link>}
                style={{ minHeight: 320 }}
              >
                <Table
                  columns={taskColumns}
                  data={failedTasksQuery.data?.items ?? []}
                  rowKey="id"
                  pagination={false}
                  loading={failedTasksQuery.isLoading}
                  size="small"
                  noDataElement="暂无失败任务"
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card
                title="最近失败通知"
                extra={<Link to="/notifications">查看全部</Link>}
                style={{ minHeight: 320 }}
              >
                <Table
                  columns={notificationColumns}
                  data={failedNotificationsQuery.data?.items ?? []}
                  rowKey="id"
                  pagination={false}
                  loading={failedNotificationsQuery.isLoading}
                  size="small"
                  noDataElement="暂无失败通知"
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  suffix,
  accent,
}: {
  title: string;
  value: number | string;
  suffix?: string;
  accent?: 'red' | 'orange';
}) {
  const color = accent === 'red' ? 'var(--color-danger-6)' : accent === 'orange' ? 'rgb(var(--orange-6))' : undefined;
  return (
    <Card size="small" style={{ height: '100%' }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {title}
      </Typography.Text>
      <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.4, color }}>
        {value}
      </div>
      {suffix ? <div className="muted">{suffix}</div> : null}
    </Card>
  );
}
