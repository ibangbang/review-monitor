import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Input, Select, Table, Tag } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { fetchApplications } from '@/lib/api/admin';
import type { AdminApplication } from '@/types/admin';
import { formatDateTime, STORE_LABELS } from '@/lib/format';

const PAGE_SIZE = 20;

const STORE_TYPES = ['apple', 'google', 'huawei', 'xiaomi', 'oppo', 'vivo', 'mock'];

export function ApplicationsPage() {
  const [keyword, setKeyword] = useState('');
  const [storeType, setStoreType] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'applications', { keyword, storeType, page }],
    queryFn: () =>
      fetchApplications({ keyword: keyword || undefined, storeType: storeType || undefined, page, pageSize: PAGE_SIZE }),
  });

  const columns: TableColumnProps<AdminApplication>[] = [
    {
      title: '应用',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name}</div>
          <div className="muted mono">{record.bundleId ?? record.packageName ?? record.id}</div>
        </div>
      ),
    },
    { title: '工作区', render: (_, record) => record.workspace?.name ?? '—' },
    {
      title: '绑定商店应用',
      render: (_, record) =>
        record.storeApps.length ? (
          <div className="stack-8">
            {record.storeApps.map((storeApp) => (
              <div key={storeApp.id} style={{ fontSize: 12 }}>
                <Tag size="small">{STORE_LABELS[storeApp.storeType] ?? storeApp.storeType}</Tag>
                <span className="mono">{storeApp.externalAppId}</span>
                {storeApp.status !== 'active' ? (
                  <Tag size="small" color="orange" style={{ marginLeft: 6 }}>
                    {storeApp.status}
                  </Tag>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <span className="muted">未绑定</span>
        ),
    },
    { title: '评价数', dataIndex: 'reviewCount', width: 90 },
    {
      title: '平均评分',
      render: (_, record) => (record.averageRating !== null ? record.averageRating.toFixed(2) : '—'),
      width: 110,
    },
    {
      title: '状态',
      render: (_, record) => (
        <Tag color={record.status === 'active' ? 'green' : 'gray'}>
          {record.status === 'active' ? '正常' : '已归档'}
        </Tag>
      ),
      width: 100,
    },
    { title: '创建时间', render: (_, record) => formatDateTime(record.createdAt), width: 180 },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>应用</h2>
          <p>平台内所有应用及其商店绑定关系，用于排查采集异常的应用范围。</p>
        </div>
      </div>

      <Card>
        <div className="filter-bar">
          <Input.Search
            allowClear
            placeholder="搜索应用名称"
            style={{ width: 260 }}
            onSearch={(value) => {
              setKeyword(value.trim());
              setPage(1);
            }}
          />
          <Select
            placeholder="商店类型"
            allowClear
            style={{ width: 160 }}
            value={storeType || undefined}
            onChange={(value) => {
              setStoreType(value ?? '');
              setPage(1);
            }}
          >
            {STORE_TYPES.map((type) => (
              <Select.Option key={type} value={type}>
                {STORE_LABELS[type] ?? type}
              </Select.Option>
            ))}
          </Select>
          <span className="muted">共 {query.data?.meta.total ?? 0} 个应用</span>
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
