import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Message, Popconfirm, Select, Table, Tag } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { fetchNotifications, retryNotification } from '@/lib/api/admin';
import type { AdminNotification } from '@/types/admin';
import { EVENT_TYPE_LABELS, formatDateTime, OUTBOX_STATUS_META } from '@/lib/format';

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [eventType, setEventType] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'notifications', { status, eventType, page }],
    queryFn: () =>
      fetchNotifications({ status: status || undefined, eventType: eventType || undefined, page, pageSize: PAGE_SIZE }),
  });

  const retryMutation = useMutation({
    mutationFn: retryNotification,
    onSuccess: () => {
      Message.success('通知已重新入队，操作已记录审计日志');
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
    },
    onError: (error: unknown) => Message.error(error instanceof Error ? error.message : '重试失败'),
  });

  const columns: TableColumnProps<AdminNotification>[] = [
    {
      title: '事件 / 标题',
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13 }}>{record.payload?.title ?? EVENT_TYPE_LABELS[record.eventType] ?? record.eventType}</div>
          <div className="muted">{EVENT_TYPE_LABELS[record.eventType] ?? record.eventType}</div>
        </div>
      ),
    },
    { title: '工作区', render: (_, record) => record.workspace?.name ?? '—', width: 150 },
    {
      title: '渠道',
      width: 180,
      render: (_, record) =>
        record.channel ? (
          <div>
            <div style={{ fontSize: 13 }}>{record.channel.name}</div>
            <div className="muted">{record.channel.channelType}</div>
          </div>
        ) : (
          <span className="muted">已删除</span>
        ),
    },
    {
      title: '状态',
      width: 100,
      render: (_, record) => {
        const meta = OUTBOX_STATUS_META[record.status];
        return <Tag color={meta?.color}>{meta?.label ?? record.status}</Tag>;
      },
    },
    { title: '尝试', width: 90, render: (_, record) => `${record.attempts} / ${record.maxAttempts}` },
    { title: '创建时间', render: (_, record) => formatDateTime(record.createdAt), width: 180 },
    { title: '发送时间', render: (_, record) => formatDateTime(record.sentAt), width: 180 },
    {
      title: '错误',
      render: (_, record) =>
        record.errorCode ? (
          <div>
            <div className="mono" style={{ color: 'var(--color-danger-6)' }}>
              {record.errorCode}
            </div>
            <div className="muted" style={{ maxWidth: 300 }}>
              {record.errorMessage}
            </div>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: '操作',
      width: 90,
      render: (_, record) =>
        record.status === 'failed' ? (
          <Popconfirm title="确认重新发送该通知？" onOk={() => retryMutation.mutate(record.id)}>
            <Button size="mini" type="text" loading={retryMutation.isPending}>
              重试
            </Button>
          </Popconfirm>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>通知</h2>
          <p>Notification Outbox 投递记录；失败可手动重发，操作写入审计日志。</p>
        </div>
      </div>

      <Card>
        <div className="filter-bar">
          <Select
            placeholder="投递状态"
            allowClear
            style={{ width: 140 }}
            value={status || undefined}
            onChange={(value) => {
              setStatus(value ?? '');
              setPage(1);
            }}
          >
            {(['pending', 'running', 'sent', 'failed', 'cancelled'] as const).map((value) => (
              <Select.Option key={value} value={value}>
                {OUTBOX_STATUS_META[value].label}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="事件类型"
            allowClear
            style={{ width: 160 }}
            value={eventType || undefined}
            onChange={(value) => {
              setEventType(value ?? '');
              setPage(1);
            }}
          >
            {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
              <Select.Option key={value} value={value}>
                {label}
              </Select.Option>
            ))}
          </Select>
          <span className="muted">共 {query.data?.meta.total ?? 0} 条投递记录</span>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          data={query.data?.items ?? []}
          loading={query.isLoading}
          scroll={{ x: 1300 }}
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
