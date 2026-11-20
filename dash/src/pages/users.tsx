import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Input, Select, Table, Tag } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { fetchUsers } from '@/lib/api/admin';
import type { AdminUser } from '@/types/admin';
import { formatDateTime } from '@/lib/format';

const PAGE_SIZE = 20;

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: '正常', color: 'green' },
  disabled: { label: '已禁用', color: 'red' },
  pending: { label: '待验证', color: 'orange' },
};

export function UsersPage() {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'users', { keyword, status, page }],
    queryFn: () => fetchUsers({ keyword: keyword || undefined, status: status || undefined, page, pageSize: PAGE_SIZE }),
  });

  const columns: TableColumnProps<AdminUser>[] = [
    {
      title: '用户',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.displayName ?? record.email}</div>
          <div className="muted">{record.email}</div>
        </div>
      ),
    },
    {
      title: '状态',
      render: (_, record) => {
        const meta = STATUS_META[record.status] ?? { label: record.status, color: 'gray' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    { title: '工作区', dataIndex: 'workspaceCount', width: 100 },
    {
      title: '邮箱验证',
      render: (_, record) =>
        record.emailVerifiedAt ? <span className="muted">{formatDateTime(record.emailVerifiedAt)}</span> : <span className="muted">未验证</span>,
      width: 180,
    },
    { title: '注册时间', render: (_, record) => formatDateTime(record.createdAt), width: 180 },
    {
      title: '用户 ID',
      render: (_, record) => <span className="mono muted">{record.id}</span>,
      width: 220,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>用户</h2>
          <p>平台注册用户列表，可按关键字与状态检索。MVP 阶段不提供管理员修改用户资料的能力。</p>
        </div>
      </div>

      <Card>
        <div className="filter-bar">
          <Input.Search
            allowClear
            placeholder="搜索邮箱 / 显示名称"
            style={{ width: 260 }}
            onSearch={(value) => {
              setKeyword(value.trim());
              setPage(1);
            }}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 140 }}
            value={status || undefined}
            onChange={(value) => {
              setStatus(value ?? '');
              setPage(1);
            }}
          >
            <Select.Option value="active">正常</Select.Option>
            <Select.Option value="disabled">已禁用</Select.Option>
            <Select.Option value="pending">待验证</Select.Option>
          </Select>
          <span className="muted">共 {query.data?.meta.total ?? 0} 位用户</span>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          data={query.data?.items ?? []}
          loading={query.isLoading}
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
