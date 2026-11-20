import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Message, Popconfirm, Select, Table, Tag } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { fetchTasks, retryTask } from '@/lib/api/admin';
import type { AdminTask } from '@/types/admin';
import { formatDateTime, formatDuration, STORE_LABELS, TASK_STATUS_META } from '@/lib/format';

const PAGE_SIZE = 20;

export function TasksPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'tasks', { status, workspaceId, page }],
    queryFn: () =>
      fetchTasks({ status: status || undefined, workspaceId: workspaceId || undefined, page, pageSize: PAGE_SIZE }),
  });

  const retryMutation = useMutation({
    mutationFn: retryTask,
    onSuccess: () => {
      Message.success('任务已重新入队，操作已记录审计日志');
      queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
    onError: (error: unknown) => Message.error(error instanceof Error ? error.message : '重试失败'),
  });

  const columns: TableColumnProps<AdminTask>[] = [
    {
      title: '任务 ID',
      width: 190,
      render: (_, record) => (
        <Link className="mono" to={`/tasks/${record.id}`}>
          {record.id}
        </Link>
      ),
    },
    {
      title: '工作区 / 应用',
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13 }}>{record.workspace?.name ?? '—'}</div>
          <div className="muted">{record.application?.name ?? '—'}</div>
        </div>
      ),
    },
    {
      title: '商店应用',
      render: (_, record) =>
        record.storeApp ? (
          <div>
            <Tag size="small">{STORE_LABELS[record.storeApp.storeType] ?? record.storeApp.storeType}</Tag>
            <span className="mono">{record.storeApp.externalAppId}</span>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: '状态',
      width: 100,
      render: (_, record) => {
        const meta = TASK_STATUS_META[record.status];
        return <Tag color={meta?.color}>{meta?.label ?? record.status}</Tag>;
      },
    },
    {
      title: '尝试',
      width: 90,
      render: (_, record) => `${record.attempts} / ${record.maxAttempts}`,
    },
    { title: '调度时间', render: (_, record) => formatDateTime(record.scheduledAt), width: 180 },
    {
      title: '耗时',
      width: 100,
      render: (_, record) => formatDuration(record.startedAt, record.finishedAt),
    },
    {
      title: '拉取 / 新增 / 更新',
      width: 150,
      render: (_, record) =>
        `${record.fetchedCount} / ${record.insertedCount} / ${record.updatedCount}`,
    },
    {
      title: '错误',
      render: (_, record) =>
        record.errorCode ? (
          <div>
            <div className="mono" style={{ color: 'var(--color-danger-6)' }}>
              {record.errorCode}
            </div>
            <div className="muted" style={{ maxWidth: 260 }}>
              {record.errorMessage}
            </div>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) =>
        record.status === 'failed' || record.status === 'cancelled' ? (
          <Popconfirm title="确认重新执行该任务？" onOk={() => retryMutation.mutate(record.id)}>
            <Button size="mini" type="text" loading={retryMutation.isPending}>
              重试
            </Button>
          </Popconfirm>
        ) : (
          <Link to={`/tasks/${record.id}`}>详情</Link>
        ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>同步任务</h2>
          <p>任务由 Scheduler 生成、Worker 原子领取执行；重试操作会写入审计日志。</p>
        </div>
      </div>

      <Card>
        <div className="filter-bar">
          <Select
            placeholder="任务状态"
            allowClear
            style={{ width: 140 }}
            value={status || undefined}
            onChange={(value) => {
              setStatus(value ?? '');
              setPage(1);
            }}
          >
            {(['pending', 'running', 'succeeded', 'failed', 'cancelled'] as const).map((value) => (
              <Select.Option key={value} value={value}>
                {TASK_STATUS_META[value].label}
              </Select.Option>
            ))}
          </Select>
          <Input
            allowClear
            placeholder="按工作区 ID 过滤"
            style={{ width: 240 }}
            value={workspaceId}
            onChange={(value) => {
              setWorkspaceId(value.trim());
              setPage(1);
            }}
          />
          <span className="muted">共 {query.data?.meta.total ?? 0} 条任务</span>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          data={query.data?.items ?? []}
          loading={query.isLoading}
          scroll={{ x: 1400 }}
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
