import { useQuery } from '@tanstack/react-query';
import { Card, Grid, Spin, Table, Tag, Typography } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { fetchIntegrations } from '@/lib/api/admin';
import type { IntegrationConnection } from '@/types/admin';
import { CONNECTION_STATUS_META, formatDateTime, STORE_LABELS } from '@/lib/format';

const { Row, Col } = Grid;

export function IntegrationsPage() {
  const query = useQuery({ queryKey: ['admin', 'integrations'], queryFn: fetchIntegrations });

  const columns: TableColumnProps<IntegrationConnection>[] = [
    {
      title: '连接',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name}</div>
          <div className="muted mono">{record.id}</div>
        </div>
      ),
    },
    {
      title: '商店',
      render: (_, record) => <Tag size="small">{STORE_LABELS[record.storeType] ?? record.storeType}</Tag>,
      width: 150,
    },
    { title: '工作区', render: (_, record) => record.workspace?.name ?? '—', width: 170 },
    {
      title: '状态',
      width: 100,
      render: (_, record) => {
        const meta = CONNECTION_STATUS_META[record.status];
        return <Tag color={meta?.color}>{meta?.label ?? record.status}</Tag>;
      },
    },
    { title: '绑定应用', dataIndex: 'storeAppCount', width: 100 },
    { title: '最近校验', render: (_, record) => formatDateTime(record.lastValidatedAt), width: 180 },
    {
      title: '最近同步错误',
      render: (_, record) =>
        record.latestSyncError?.code ? (
          <div>
            <div className="mono" style={{ color: 'var(--color-danger-6)' }}>
              {record.latestSyncError.code}
            </div>
            <div className="muted" style={{ maxWidth: 260 }}>
              {record.latestSyncError.message}
            </div>
            <div className="muted">{formatDateTime(record.latestSyncError.at)}</div>
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
          <h2>商店集成</h2>
          <p>
            各商店 Adapter 的接入概况 · 采集于 {query.data ? formatDateTime(query.data.asOf) : '—'} ·
            本页不展示任何凭据或密文
          </p>
        </div>
      </div>

      {query.isLoading ? (
        <Spin style={{ display: 'block', margin: '80px auto' }} />
      ) : (
        <>
          <Row gutter={12}>
            {(query.data?.summary ?? []).map((item) => {
              const supported = item.storeType !== 'xiaomi' && item.storeType !== 'oppo' && item.storeType !== 'vivo';
              return (
                <Col span={6} key={item.storeType} style={{ marginBottom: 12 }}>
                  <Card size="small">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography.Text style={{ fontWeight: 600 }}>{item.label}</Typography.Text>
                      <Tag size="small" color={supported ? (item.invalid ? 'red' : 'green') : 'gray'}>
                        {supported ? (item.invalid ? '存在失效连接' : '可用') : '暂未接入'}
                      </Tag>
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      连接 {item.connections} · 正常 {item.active} · 失效 {item.invalid}
                    </div>
                    <div className="muted">绑定商店应用 {item.storeApps}</div>
                  </Card>
                </Col>
              );
            })}
          </Row>

          <Card title="连接明细" style={{ marginTop: 12 }}>
            <Table
              rowKey="id"
              columns={columns}
              data={query.data?.connections ?? []}
              pagination={{ pageSize: 20, showTotal: true }}
              noDataElement="暂无商店连接"
            />
          </Card>

          <Card title="Adapter 覆盖说明" style={{ marginTop: 12 }}>
            <Typography.Text style={{ fontSize: 13 }}>
              MVP 已实现 App Store Connect、Google Play、华为应用市场的官方接口适配，并提供演示商店（mock）用于本地联调。
              Xiaomi GetApps、OPPO、vivo 暂未接入，工作区无法创建对应连接。所有 Adapter 仅调用官方 API，不抓取网页。
            </Typography.Text>
          </Card>
        </>
      )}
    </div>
  );
}
