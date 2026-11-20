import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Plus, RefreshCcw, Save, Trash2, X } from 'lucide-react';
import { useActiveWorkspace, useCanManage } from '@/store/session';
import { qk } from '@/lib/queryKeys';
import {
  archiveApplication,
  createStoreApp,
  deleteStoreApp,
  fetchApplication,
  updateApplication,
  updateStoreApp,
} from '@/lib/api/applications';
import { fetchStoreConnections, STORE_LABELS, SUPPORTED_STORES } from '@/lib/api/stores';
import type { PublicStoreApp, StoreType } from '@/types/api';
import { PageHeader, SectionCard, LoadingBlock, ErrorBlock, InfoRow } from '@/components/common/page';
import { StoreBadge } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { StarRating } from '@/components/ui/star-rating';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatRelative } from '@/lib/utils';

const INTERVAL_OPTIONS = [15, 30, 60, 180, 360, 720];

export function ApplicationDetailPage() {
  const { applicationId = '' } = useParams();
  const workspace = useActiveWorkspace();
  const workspaceId = workspace?.publicId ?? null;
  const canManage = useCanManage();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [bindOpen, setBindOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', bundleId: '', packageName: '', iconUrl: '', description: '' });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.application(workspaceId ?? '', applicationId) });
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    queryClient.invalidateQueries({ queryKey: ['store-apps'] });
  };

  const appQuery = useQuery({
    queryKey: qk.application(workspaceId ?? '', applicationId),
    queryFn: () => fetchApplication(applicationId, workspaceId as string),
    enabled: Boolean(workspaceId && applicationId),
  });

  const connectionsQuery = useQuery({
    queryKey: qk.connections(workspaceId ?? '', { pageSize: 100 }),
    queryFn: () => fetchStoreConnections({ pageSize: 100 }, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const app = appQuery.data;
  const storeApps = app?.storeApps ?? [];

  const updateMutation = useMutation({
    mutationFn: () =>
      updateApplication(
        applicationId,
        {
          name: editForm.name.trim(),
          bundleId: editForm.bundleId.trim() || null,
          packageName: editForm.packageName.trim() || null,
          iconUrl: editForm.iconUrl.trim() || null,
          description: editForm.description.trim() || null,
        },
        workspaceId as string,
      ),
    onSuccess: () => {
      toast.push('success', '应用已更新');
      setEditOpen(false);
      invalidate();
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '更新失败'),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveApplication(applicationId, workspaceId as string),
    onSuccess: () => {
      toast.push('success', '应用已归档');
      invalidate();
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '归档失败'),
  });

  if (appQuery.isLoading) return <LoadingBlock rows={8} />;
  if (appQuery.isError || !app) return <ErrorBlock message="应用不存在" onRetry={() => appQuery.refetch()} />;

  const availableConnections = (storeType: StoreType) =>
    connectionsQuery.data?.items.filter((item) => item.storeType === storeType) ?? [];

  return (
    <div>
      <Link to="/app/applications" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回应用列表
      </Link>

      <PageHeader
        title={app.name}
        breadcrumb={[{ label: '应用', to: '/app/applications' }, { label: app.name }]}
        meta={`${app.enabledStoreAppCount}/${app.storeAppCount} 个市场绑定启用中 · ${app.lastSyncedAt ? `最近同步 ${formatRelative(app.lastSyncedAt)}` : '尚未同步'}`}
        actions={
          canManage ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditForm({
                    name: app.name,
                    bundleId: app.bundleId ?? '',
                    packageName: app.packageName ?? '',
                    iconUrl: app.iconUrl ?? '',
                    description: app.description ?? '',
                  });
                  setEditOpen(true);
                }}
              >
                编辑
              </Button>
              <Button onClick={() => setBindOpen(true)}>
                <Plus className="h-4 w-4" /> 绑定市场
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard
            title="市场绑定"
            description="每个绑定对应一个商店条目（如 App Store 中国区、Google Play 美国区）"
            action={<span className="text-xs text-muted-foreground">{storeApps.length} 个</span>}
          >
            {storeApps.length ? (
              <ul className="space-y-3">
                {storeApps.map((binding) => (
                  <BindingRow
                    key={binding.id}
                    binding={binding}
                    workspaceId={workspaceId as string}
                    canManage={canManage}
                    onChanged={invalidate}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Plus}
                title="还没有绑定市场"
                description="没有绑定就不会采集评价。添加 App Store、Google Play 或华为市场条目。"
                action={
                  canManage ? (
                    <Button size="sm" onClick={() => setBindOpen(true)}>
                      <Plus className="h-3.5 w-3.5" /> 绑定市场
                    </Button>
                  ) : undefined
                }
              />
            )}
          </SectionCard>

          <SectionCard title="应用概览">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="评价总数" value={String(app.reviewCount)} />
              <Stat label="近 7 天新增" value={String(app.newReviews7d)} />
              <Stat
                label="平均评分"
                value={app.averageRating != null ? app.averageRating.toFixed(1) : '—'}
                extra={app.averageRating != null ? <StarRating rating={app.averageRating} size={12} /> : null}
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="应用信息">
            <div className="flex items-center gap-3">
              {app.iconUrl ? (
                <img src={app.iconUrl} alt="" className="h-12 w-12 rounded-lg border object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                  {app.name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{app.name}</p>
                <Badge tone={app.status === 'active' ? 'success' : 'muted'}>{app.status === 'active' ? '使用中' : '已归档'}</Badge>
              </div>
            </div>
            <div className="mt-4">
              <InfoRow label="Bundle ID">{app.bundleId ?? '—'}</InfoRow>
              <InfoRow label="Package">{app.packageName ?? '—'}</InfoRow>
              <InfoRow label="创建时间">{formatDate(app.createdAt)}</InfoRow>
            </div>
            {app.description ? <p className="mt-3 text-xs text-muted-foreground">{app.description}</p> : null}
          </SectionCard>

          {canManage ? (
            <SectionCard title="危险操作">
              <p className="text-xs text-muted-foreground">
                归档会暂停所有市场绑定并停止采集，历史评价与备注会保留。
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-3"
                disabled={app.status === 'archived'}
                loading={archiveMutation.isPending}
                onClick={() => {
                  if (window.confirm('确认归档该应用？')) archiveMutation.mutate();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> 归档应用
              </Button>
            </SectionCard>
          ) : null}
        </div>
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="编辑应用">
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-name">应用名称</Label>
            <Input
              id="edit-name"
              value={editForm.name}
              onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-bundle">Bundle ID</Label>
              <Input
                id="edit-bundle"
                value={editForm.bundleId}
                onChange={(event) => setEditForm({ ...editForm, bundleId: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-package">Package Name</Label>
              <Input
                id="edit-package"
                value={editForm.packageName}
                onChange={(event) => setEditForm({ ...editForm, packageName: event.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-icon">图标链接</Label>
            <Input
              id="edit-icon"
              value={editForm.iconUrl}
              onChange={(event) => setEditForm({ ...editForm, iconUrl: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="edit-desc">备注</Label>
            <Input
              id="edit-desc"
              value={editForm.description}
              onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button loading={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              <Save className="h-3.5 w-3.5" /> 保存
            </Button>
          </div>
        </div>
      </Dialog>

      <BindStoreAppDialog
        open={bindOpen}
        onClose={() => setBindOpen(false)}
        applicationId={applicationId}
        workspaceId={workspaceId as string}
        availableConnections={availableConnections}
        onCreated={invalidate}
      />
    </div>
  );
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 px-4 py-3">
      <p className="text-lg font-semibold">{value}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {extra}
      </div>
    </div>
  );
}

function BindingRow({
  binding,
  workspaceId,
  canManage,
  onChanged,
}: {
  binding: PublicStoreApp;
  workspaceId: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [intervalMinutes, setIntervalMinutes] = useState(binding.sync?.intervalMinutes ?? 15);

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => updateStoreApp(binding.id, { enabled, intervalMinutes }, workspaceId),
    onSuccess: () => {
      toast.push('success', '同步设置已更新');
      onChanged();
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '更新失败'),
  });

  const intervalMutation = useMutation({
    mutationFn: () => updateStoreApp(binding.id, { intervalMinutes }, workspaceId),
    onSuccess: () => {
      toast.push('success', '采集频率已更新');
      onChanged();
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteStoreApp(binding.id, workspaceId),
    onSuccess: () => {
      toast.push('success', '绑定已移除');
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      onChanged();
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '移除失败'),
  });

  const sync = binding.sync;

  return (
    <li className="rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StoreBadge storeType={binding.storeType} />
            <span className="truncate font-mono text-xs">{binding.externalAppId}</span>
            <Badge tone="muted">{binding.countryCode}</Badge>
            {binding.status !== 'active' ? <Badge tone="warning">已暂停</Badge> : null}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {binding.connection ? `凭据：${binding.connection.name}` : '无需凭据'} ·{' '}
            {sync?.lastSyncedAt ? `上次同步 ${formatRelative(sync.lastSyncedAt)}` : '尚未同步'}
            {binding.reviewCount !== undefined ? ` · 评价 ${binding.reviewCount} 条` : ''}
          </p>
          {sync?.lastErrorMessage ? (
            <p className="mt-1 text-[11px] text-red-600">
              {sync.lastErrorCode}：{sync.lastErrorMessage}
            </p>
          ) : null}
        </div>

        {canManage ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">启用</span>
              <Switch
                checked={binding.status === 'active'}
                disabled={toggleMutation.isPending}
                onChange={(next) => toggleMutation.mutate(next)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="移除绑定"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm('确认移除该市场绑定？已采集的评价会保留。')) deleteMutation.mutate();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-[11px] text-muted-foreground">
          <span>采集频率</span>
          <Select
            className="h-8 w-24 text-xs"
            value={String(intervalMinutes)}
            onChange={(event) => setIntervalMinutes(Number(event.target.value))}
          >
            {INTERVAL_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} 分钟
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={intervalMinutes === (sync?.intervalMinutes ?? 15) || intervalMutation.isPending}
            onClick={() => intervalMutation.mutate()}
          >
            <RefreshCcw className="h-3 w-3" /> 应用
          </Button>
          {sync?.nextSyncAt ? <span>下次 {formatRelative(sync.nextSyncAt)}</span> : null}
        </div>
      ) : null}
    </li>
  );
}

function BindStoreAppDialog({
  open,
  onClose,
  applicationId,
  workspaceId,
  availableConnections,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  workspaceId: string;
  availableConnections: (storeType: StoreType) => { id: string; name: string; storeType: StoreType; status: string }[];
  onCreated: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    storeType: 'mock' as StoreType,
    externalAppId: '',
    countryCode: 'CN',
    storeConnectionId: '',
    storeUrl: '',
    displayName: '',
    intervalMinutes: 15,
  });
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => availableConnections(form.storeType), [availableConnections, form.storeType]);

  const mutation = useMutation({
    mutationFn: () =>
      createStoreApp(
        applicationId,
        {
          storeType: form.storeType,
          externalAppId: form.externalAppId.trim(),
          countryCode: form.countryCode.trim().toUpperCase(),
          storeConnectionId: form.storeType === 'mock' ? null : form.storeConnectionId || null,
          storeUrl: form.storeUrl.trim() || null,
          displayName: form.displayName.trim() || null,
          enabled: true,
          intervalMinutes: form.intervalMinutes,
        },
        workspaceId,
      ),
    onSuccess: () => {
      toast.push('success', '市场绑定已创建，等待首次采集');
      onCreated();
      onClose();
      setForm({ ...form, externalAppId: '', storeUrl: '', displayName: '' });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : '绑定失败'),
  });

  function submit() {
    if (!form.externalAppId.trim()) {
      setError('请填写商店应用 ID');
      return;
    }
    if (!/^[A-Za-z]{2}$/.test(form.countryCode.trim())) {
      setError('国家代码需为 2 位字母，如 CN / US');
      return;
    }
    if (form.storeType !== 'mock' && !form.storeConnectionId) {
      setError('请选择对应市场的凭据');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  const requiresConnection = form.storeType !== 'mock';

  return (
    <Dialog open={open} onClose={onClose} title="绑定市场条目" description="填写商店中的应用标识，系统会按采集频率拉取评价。">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bind-store">市场</Label>
            <Select
              id="bind-store"
              value={form.storeType}
              onChange={(event) =>
                setForm({ ...form, storeType: event.target.value as StoreType, storeConnectionId: '' })
              }
            >
              {SUPPORTED_STORES.map((store) => (
                <option key={store} value={store}>
                  {STORE_LABELS[store] ?? store}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="bind-country" hint="2 位字母">
              国家 / 地区
            </Label>
            <Input
              id="bind-country"
              value={form.countryCode}
              maxLength={2}
              onChange={(event) => setForm({ ...form, countryCode: event.target.value.toUpperCase() })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="bind-external" hint={form.storeType === 'mock' ? '任意演示标识' : '商店中的应用 ID'}>
            商店应用 ID
          </Label>
          <Input
            id="bind-external"
            value={form.externalAppId}
            placeholder={form.storeType === 'apple' ? '1234567890' : form.storeType === 'google' ? 'com.example.app' : 'demo-focus'}
            onChange={(event) => setForm({ ...form, externalAppId: event.target.value })}
          />
        </div>

        {requiresConnection ? (
          <div>
            <Label htmlFor="bind-connection">
              市场凭据
            </Label>
            <Select
              id="bind-connection"
              value={form.storeConnectionId}
              onChange={(event) => setForm({ ...form, storeConnectionId: event.target.value })}
            >
              <option value="">请选择凭据</option>
              {options.map((connection) => (
                <option key={connection.id} value={connection.id} disabled={connection.status !== 'active'}>
                  {connection.name} {connection.status !== 'active' ? '（不可用）' : ''}
                </option>
              ))}
            </Select>
            {!options.length ? (
              <p className="mt-1 text-[11px] text-amber-700">
                还没有 {STORE_LABELS[form.storeType]} 凭据，请先到「市场连接」页添加。
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            演示商店会生成本地模拟评价，用于体验完整流程，不会访问外部接口。
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bind-interval">采集频率</Label>
            <Select
              id="bind-interval"
              value={String(form.intervalMinutes)}
              onChange={(event) => setForm({ ...form, intervalMinutes: Number(event.target.value) })}
            >
              {INTERVAL_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  每 {minutes} 分钟
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="bind-display">显示名称</Label>
            <Input
              id="bind-display"
              value={form.displayName}
              placeholder="可选"
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="bind-url">商店链接</Label>
          <Input
            id="bind-url"
            value={form.storeUrl}
            placeholder="https://…"
            onChange={(event) => setForm({ ...form, storeUrl: event.target.value })}
          />
        </div>

        <FieldError message={error ?? undefined} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button loading={mutation.isPending} onClick={submit}>
            <Check className="h-3.5 w-3.5" /> 创建绑定
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
