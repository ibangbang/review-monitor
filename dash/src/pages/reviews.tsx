import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Card, DatePicker, Input, Select, Table, Tag } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { fetchReviews } from '@/lib/api/admin';
import type { AdminReview } from '@/types/admin';
import { formatDateTime, ratingStars, REVIEW_STATUS_META, STORE_LABELS } from '@/lib/format';

const PAGE_SIZE = 20;
const STORE_TYPES = ['apple', 'google', 'huawei', 'xiaomi', 'oppo', 'vivo', 'mock'];

export function ReviewsPage() {
  const [keyword, setKeyword] = useState('');
  const [storeType, setStoreType] = useState('');
  const [rating, setRating] = useState<string>('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'reviews', { keyword, storeType, rating, status, range, page }],
    queryFn: () =>
      fetchReviews({
        keyword: keyword || undefined,
        storeType: storeType || undefined,
        rating: rating || undefined,
        status: status || undefined,
        from: range[0] ? dayjs(range[0]).startOf('day').toISOString() : undefined,
        to: range[1] ? dayjs(range[1]).endOf('day').toISOString() : undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const resetPage = () => setPage(1);

  const columns: TableColumnProps<AdminReview>[] = [
    {
      title: '评分',
      width: 110,
      render: (_, record) => (
        <div>
          <div style={{ color: 'rgb(var(--orange-6))', fontSize: 12 }}>{ratingStars(record.rating)}</div>
          <div className="muted">{record.rating} 星</div>
        </div>
      ),
    },
    {
      title: '评价',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{record.title ?? '(无标题)'}</div>
          <div className="muted" style={{ maxWidth: 480 }}>
            {record.contentExcerpt}
          </div>
        </div>
      ),
    },
    {
      title: '应用 / 工作区',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13 }}>{record.application?.name ?? '—'}</div>
          <div className="muted">{record.workspace?.name ?? '—'}</div>
        </div>
      ),
    },
    {
      title: '商店',
      width: 130,
      render: (_, record) => <Tag size="small">{STORE_LABELS[record.storeType] ?? record.storeType}</Tag>,
    },
    {
      title: '状态',
      width: 100,
      render: (_, record) => {
        const meta = REVIEW_STATUS_META[record.internalStatus];
        return <Tag color={meta?.color}>{meta?.label ?? record.internalStatus}</Tag>;
      },
    },
    { title: '国家', dataIndex: 'countryCode', width: 80 },
    { title: '版本', render: (_, record) => record.appVersion ?? '—', width: 90 },
    { title: '发布时间', render: (_, record) => formatDateTime(record.sourceCreatedAt), width: 180 },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>评价</h2>
          <p>全平台评价检索，用于定位用户反馈与异常来源；内容已按工作区隔离存储。</p>
        </div>
      </div>

      <Card>
        <div className="filter-bar">
          <Input.Search
            allowClear
            placeholder="搜索标题 / 内容 / 作者"
            style={{ width: 240 }}
            onSearch={(value) => {
              setKeyword(value.trim());
              resetPage();
            }}
          />
          <Select
            placeholder="商店"
            allowClear
            style={{ width: 150 }}
            value={storeType || undefined}
            onChange={(value) => {
              setStoreType(value ?? '');
              resetPage();
            }}
          >
            {STORE_TYPES.map((type) => (
              <Select.Option key={type} value={type}>
                {STORE_LABELS[type] ?? type}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="评分"
            allowClear
            style={{ width: 100 }}
            value={rating || undefined}
            onChange={(value) => {
              setRating(value ?? '');
              resetPage();
            }}
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <Select.Option key={value} value={String(value)}>
                {value} 星
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="处理状态"
            allowClear
            style={{ width: 130 }}
            value={status || undefined}
            onChange={(value) => {
              setStatus(value ?? '');
              resetPage();
            }}
          >
            <Select.Option value="unprocessed">待处理</Select.Option>
            <Select.Option value="processing">处理中</Select.Option>
            <Select.Option value="resolved">已处理</Select.Option>
            <Select.Option value="ignored">已忽略</Select.Option>
          </Select>
          <DatePicker.RangePicker
            style={{ width: 240 }}
            value={range}
            onChange={(value) => {
              setRange(value);
              resetPage();
            }}
          />
          <span className="muted">共 {query.data?.meta.total ?? 0} 条</span>
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
