import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Input, Select, Table, Tag } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { fetchWorkspaces } from '@/lib/api/admin';
import type { AdminWorkspace } from '@/types/admin';
import { formatDateTime } from '@/lib/format';

const PAGE_SIZE = 20;

export function WorkspacesPage() {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'workspaces', { keyword, status, page }],
    queryFn: () =>
      fetchWorkspaces({ keyword: keyword || undefined, status: status || undefined, page, pageSize: PAGE_SIZE }),
  });

  const columns: TableColumnProps<AdminWorkspace>[] = [
    {
      title: '工作区',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name}</div>
          <div className="muted mono">{record.id}</div>
        </div>
      ),
    },
    {
      title: '拥有者',
      render: (_, record) =>
        record.owner ? (
          <div>
            <div>{record.owner.displayName ?? record.owner.email}</div>
            <div className="muted">{record.owner.email}</div>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: '状态',
      render: (_, record) => (
        <Tag color={record.status === 'active' ? 'green' : record.status === 'suspended' ? 'orange' : 'gray'}>
          {record.status === 'active' ? '正常' : record.status === 'suspended' ? '已暂停' : '已删除'}
        </Tag>
      ),
      width: 100,
    },
    { title: '成员', dataIndex: 'memberCount', width: 80 },
    { title: '应用', dataIndex: 'applicationCount', width: 80 },
    { title: '评价', dataIndex: 'reviewCount', width: 90 },
    { title: '创建时间', render: (_, record) => formatDateTime(record.createdAt), width: 180 },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>工作区</h2>
          <p>工作区是租户隔离边界，列表展示拥有者、成员数与数据量。</p>
        </div>
      </div>

      <Card>
        <div className="filter-bar">
          <Input.Search
            allowClear
            placeholder="搜索工作区名称"
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
            <Select.Option value="suspended">已暂停</Select.Option>
            <Select.Option value="deleted">已删除</Select.Option>
          </Select>
          <span className="muted">共 {query.data?.meta.total ?? 0} 个工作区</span>
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
