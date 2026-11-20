import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Card, DatePicker, Input, Select, Table, Tag, Typography } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { fetchAuditLogs } from '@/lib/api/admin';
import type { AuditLog } from '@/types/admin';
import { formatDateTime } from '@/lib/format';

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, string> = {
  'admin.login': '管理员登录',
  'admin.logout': '管理员退出',
  'task.retry': '手动重试任务',
  'notification.retry': '手动重试通知',
};

export function AuditLogsPage() {
  const [actorType, setActorType] = useState('');
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [range, setRange] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'audit-logs', { actorType, action, resourceType, range, page }],
    queryFn: () =>
      fetchAuditLogs({
        actorType: actorType || undefined,
        action: action || undefined,
        resourceType: resourceType || undefined,
        from: range[0] ? dayjs(range[0]).startOf('day').toISOString() : undefined,
        to: range[1] ? dayjs(range[1]).endOf('day').toISOString() : undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const columns: TableColumnProps<AuditLog>[] = [
    {
      title: '时间',
      width: 180,
      render: (_, record) => formatDateTime(record.createdAt),
    },
    {
      title: '操作者',
      width: 220,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13 }}>{record.actor?.displayName ?? record.actor?.email ?? '系统'}</div>
          <div className="muted">{record.actor?.email ?? record.actorType}</div>
        </div>
      ),
    },
    {
      title: '动作',
      width: 180,
      render: (_, record) => (
        <div>
          <Tag size="small" color="arcoblue">
            {ACTION_LABELS[record.action] ?? record.action}
          </Tag>
          <div className="muted mono">{record.action}</div>
        </div>
      ),
    },
    {
      title: '对象',
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13 }}>{record.resourceType}</div>
          <div className="muted mono">{record.resourceId ?? '—'}</div>
        </div>
      ),
    },
    {
      title: '变更摘要',
      render: (_, record) => {
        const before = record.beforeSummary;
        const after = record.afterSummary;
        if (!before && !after) return <span className="muted">—</span>;
        return (
          <Typography.Paragraph style={{ marginBottom: 0, fontSize: 12 }} ellipsis={{ rows: 2, expandable: true }}>
            {JSON.stringify({ before, after })}
          </Typography.Paragraph>
        );
      },
    },
    {
      title: '来源 IP',
      width: 160,
      render: (_, record) => <span className="mono muted">{record.ip ?? '—'}</span>,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>审计日志</h2>
          <p>管理员登录、手动重试等敏感操作均写入 audit_logs，可追溯操作者、对象与时间。</p>
        </div>
      </div>

      <Card>
        <div className="filter-bar">
          <Select
            placeholder="操作者类型"
            allowClear
            style={{ width: 140 }}
            value={actorType || undefined}
            onChange={(value) => {
              setActorType(value ?? '');
              setPage(1);
            }}
          >
            <Select.Option value="admin">管理员</Select.Option>
            <Select.Option value="user">用户</Select.Option>
            <Select.Option value="system">系统</Select.Option>
          </Select>
          <Input
            allowClear
            placeholder="动作，如 admin.login"
            style={{ width: 200 }}
            value={action}
            onChange={(value) => {
              setAction(value.trim());
              setPage(1);
            }}
          />
          <Input
            allowClear
            placeholder="资源类型，如 review_task"
            style={{ width: 220 }}
            value={resourceType}
            onChange={(value) => {
              setResourceType(value.trim());
              setPage(1);
            }}
          />
          <DatePicker.RangePicker
            style={{ width: 240 }}
            value={range}
            onChange={(value) => {
              setRange(value);
              setPage(1);
            }}
          />
          <span className="muted">共 {query.data?.meta.total ?? 0} 条记录</span>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          data={query.data?.items ?? []}
          loading={query.isLoading}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: query.data?.meta.total ?? 0,
            showTotal: true,
            onChange: (next) => setPage(next),
          }}
        />
      </Card>
    </div>
  );
}
