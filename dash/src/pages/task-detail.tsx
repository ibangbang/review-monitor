import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Descriptions,
  Message,
  Popconfirm,
  Spin,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { fetchTaskDetail, retryTask } from '@/lib/api/admin';
import type { TaskAttempt } from '@/types/admin';
import { formatDateTime, formatDuration, STORE_LABELS, TASK_STATUS_META } from '@/lib/format';

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'task', taskId],
    queryFn: () => fetchTaskDetail(taskId as string),
    enabled: Boolean(taskId),
  });

  const retryMutation = useMutation({
    mutationFn: () => retryTask(taskId as string),
    onSuccess: () => {
      Message.success('任务已重新入队，操作已记录审计日志');
      queryClient.invalidateQueries({ queryKey: ['admin', 'task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
    },
    onError: (error: unknown) => Message.error(error instanceof Error ? error.message : '重试失败'),
  });

  const task = query.data;
  const meta = task ? TASK_STATUS_META[task.status] : undefined;

  const attemptColumns: TableColumnProps<TaskAttempt>[] = [
    { title: '第几次', dataIndex: 'attemptNo', width: 90 },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '开始', render: (_, record) => formatDateTime(record.startedAt), width: 180 },
    { title: '结束', render: (_, record) => formatDateTime(record.finishedAt), width: 180 },
    { title: '耗时', render: (_, record) => (record.durationMs !== null ? `${record.durationMs} ms` : '—'), width: 100 },
    {
      title: '拉取 / 新增 / 更新',
      render: (_, record) => `${record.fetchedCount} / ${record.insertedCount} / ${record.updatedCount}`,
    },
    {
      title: '错误',
      render: (_, record) =>
        record.errorCode ? (
          <div>
            <div className="mono" style={{ color: 'var(--color-danger-6)' }}>
              {record.errorCode}
            </div>
            <div className="muted">{record.errorMessage}</div>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>任务详情</h2>
          <p>
            <Link to="/tasks">← 返回任务列表</Link>
            {task ? <span className="mono" style={{ marginLeft: 12 }}>{task.id}</span> : null}
          </p>
        </div>
        {task && (task.status === 'failed' || task.status === 'cancelled') ? (
          <Popconfirm title="确认重新执行该任务？" onOk={() => retryMutation.mutate()}>
            <Button type="primary" loading={retryMutation.isPending}>
              重新执行
            </Button>
          </Popconfirm>
        ) : null}
      </div>

      {query.isLoading ? (
        <Spin style={{ display: 'block', margin: '80px auto' }} />
      ) : !task ? (
        <Card>
          <Typography.Text type="secondary">任务不存在或已被清理。</Typography.Text>
        </Card>
      ) : (
        <>
          <Card style={{ marginBottom: 12 }}>
            <Descriptions
              column={3}
              data={[
                { label: '状态', value: <Tag color={meta?.color}>{meta?.label ?? task.status}</Tag> },
                { label: '任务类型', value: task.taskType },
                { label: '尝试次数', value: `${task.attempts} / ${task.maxAttempts}` },
                { label: '工作区', value: task.workspace?.name ?? '—' },
                { label: '应用', value: task.application?.name ?? '—' },
                {
                  label: '商店应用',
                  value: task.storeApp
                    ? `${STORE_LABELS[task.storeApp.storeType] ?? task.storeApp.storeType} · ${task.storeApp.externalAppId}`
                    : '—',
                },
                { label: '调度时间', value: formatDateTime(task.scheduledAt) },
                { label: '开始时间', value: formatDateTime(task.startedAt) },
                { label: '结束时间', value: formatDateTime(task.finishedAt) },
                { label: '租约到期', value: formatDateTime(task.lockedUntil) },
                { label: '下次重试', value: formatDateTime(task.nextRetryAt) },
                { label: '执行耗时', value: formatDuration(task.startedAt, task.finishedAt) },
                { label: '拉取数量', value: task.fetchedCount },
                { label: '新增数量', value: task.insertedCount },
                { label: '更新数量', value: task.updatedCount },
                { label: '错误码', value: <span className="mono">{task.errorCode ?? '—'}</span>, span: 2 },
                {
                  label: '错误信息',
                  value: task.errorMessage ? (
                    <span style={{ color: 'var(--color-danger-6)' }}>{task.errorMessage}</span>
                  ) : (
                    '—'
                  ),
                  span: 3,
                },
              ]}
            />
          </Card>

          <Card title="尝试历史" style={{ marginBottom: 12 }}>
            <Table
              rowKey="attemptNo"
              columns={attemptColumns}
              data={task.attempts ?? []}
              pagination={false}
              size="small"
              noDataElement="暂无尝试记录"
            />
          </Card>

          <Card title="任务输入摘要">
            <Descriptions
              column={2}
              data={[
                { label: 'storeAppId', value: <span className="mono">{task.storeApp?.id ?? '—'}</span> },
                { label: 'workspaceId', value: <span className="mono">{task.workspace?.id ?? '—'}</span> },
                { label: 'applicationId', value: <span className="mono">{task.application?.id ?? '—'}</span> },
                { label: 'taskId', value: <span className="mono">{task.id}</span> },
              ]}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              任务输入仅包含内部标识，Worker 从数据库读取并解密凭据；此处不展示任何密钥或密文。
            </Typography.Text>
          </Card>
        </>
      )}
    </div>
  );
}
