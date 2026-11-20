import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { useActiveWorkspace, useCanManage } from '@/store/session';
import { deleteStoreConnection, fetchStoreConnection, updateStoreConnection, validateStoreConnection } from '@/lib/api/stores';
import { PageHeader, SectionCard, LoadingBlock, ErrorBlock, InfoRow } from '@/components/common/page';
import { ConnectionStatusBadge, StoreBadge } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatRelative } from '@/lib/utils';

export function StoreDetailPage() {
  const { connectionId = '' } = useParams();
  const workspace = useActiveWorkspace();
  const workspaceId = workspace?.publicId ?? null;
  const canManage = useCanManage();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ['store-connection', workspaceId ?? '', connectionId],
    queryFn: () => fetchStoreConnection(connectionId, workspaceId as string),
    enabled: Boolean(workspaceId && connectionId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['store-connection'] });
    queryClient.invalidateQueries({ queryKey: ['store-connections'] });
  };

  const renameMutation = useMutation({
    mutationFn: (next: string) => updateStoreConnection(connectionId, { name: next }, workspaceId as string),
    onSuccess: () => {
      toast.push('success', '名称已更新');
      invalidate();
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '更新失败'),
  });

  const validateMutation = useMutation({
    mutationFn: () => validateStoreConnection(connectionId, workspaceId as string),
    onSuccess: (result) => {
      if (result.valid) toast.push('success', '连接校验通过');
      else toast.push('error', result.message ?? '校验失败');
      invalidate();
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '校验失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteStoreConnection(connectionId, workspaceId as string),
    onSuccess: () => {
      toast.push('success', '凭据已删除');
      queryClient.invalidateQueries({ queryKey: ['store-connections'] });
      navigate('/app/stores', { replace: true });
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '删除失败'),
  });

  if (detailQuery.isLoading) return <LoadingBlock rows={6} />;
  if (detailQuery.isError || !detailQuery.data) return <ErrorBlock message="凭据不存在" onRetry={() => detailQuery.refetch()} />;

  const connection = detailQuery.data;
  const currentName = name ?? connection.name;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/stores" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回市场连接
      </Link>

      <PageHeader
        title={connection.name}
        breadcrumb={[{ label: '市场连接', to: '/app/stores' }, { label: connection.name }]}
        meta={
          connection.lastValidatedAt
            ? `最近校验 ${formatRelative(connection.lastValidatedAt)}`
            : '尚未校验，建议先执行一次连接校验'
        }
        actions={
          <div className="flex items-center gap-2">
            <StoreBadge storeType={connection.storeType} />
            <ConnectionStatusBadge status={connection.status} />
          </div>
        }
      />

      {connection.lastErrorMessage ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          <p className="font-medium">{connection.lastErrorCode ?? '校验失败'}</p>
          <p className="mt-0.5">{connection.lastErrorMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <SectionCard title="连接信息">
          <InfoRow label="市场">
            <Badge tone="muted">{connection.storeType}</Badge>
          </InfoRow>
          <InfoRow label="绑定应用">{connection.storeAppCount} 个</InfoRow>
          <InfoRow label="创建时间">{formatDate(connection.createdAt)}</InfoRow>
          <InfoRow label="最近校验">
            {connection.lastValidatedAt ? formatDate(connection.lastValidatedAt) : '—'}
          </InfoRow>
        </SectionCard>

        <SectionCard title="操作">
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              loading={validateMutation.isPending}
              onClick={() => validateMutation.mutate()}
            >
              <Zap className="h-3.5 w-3.5" /> 验证连接
            </Button>
            {canManage ? (
              <Button
                variant="destructive"
                className="w-full justify-start"
                loading={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm('删除凭据后，相关市场绑定将暂停采集。确认删除？')) deleteMutation.mutate();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> 删除凭据
              </Button>
            ) : null}
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
            出于安全考虑不提供凭据回显。更新凭据请联系工作区管理员重新录入。
          </p>
        </SectionCard>
      </div>

      {canManage ? (
        <SectionCard title="重命名" className="mt-5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="conn-rename">凭据名称</Label>
              <Input id="conn-rename" value={currentName} onChange={(event) => setName(event.target.value)} />
            </div>
            <Button
              disabled={!currentName.trim() || currentName === connection.name}
              loading={renameMutation.isPending}
              onClick={() => renameMutation.mutate(currentName.trim())}
            >
              <Save className="h-3.5 w-3.5" /> 保存
            </Button>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
