import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlugZap, Plus, ShieldCheck } from 'lucide-react';
import { useActiveWorkspace, useCanManage } from '@/store/session';
import { qk } from '@/lib/queryKeys';
import { createStoreConnection, fetchStoreConnections, STORE_LABELS, SUPPORTED_STORES } from '@/lib/api/stores';
import type { StoreType } from '@/types/api';
import { PageHeader, SectionCard, LoadingBlock, ErrorBlock } from '@/components/common/page';
import { ConnectionStatusBadge } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatRelative } from '@/lib/utils';

const STORE_HINTS: Record<string, string> = {
  apple: 'App Store Connect API Key（Issuer ID / Key ID / .p8 私钥）',
  google: 'Google Play 服务账号 JSON（client_email / private_key）',
  huawei: '华为 AGC OAuth 客户端（Client ID / Client Secret）',
  mock: '本地模拟数据，用于体验完整采集流程',
};

const STORE_DOCS: Record<string, string> = {
  apple: '需要 App Store Connect → 用户和访问 → 集成 → App Store Connect API 生成的密钥。',
  google: '需要 Google Cloud 服务账号并在 Play Console 授予「查看应用信息」与「查看财务数据」以外的评价读取权限。',
  huawei: '需要 AGC 项目中的 OAuth 2.0 客户端凭据，账号需具备应用信息读取权限。',
  mock: '演示商店在服务端生成确定性模拟评价，不发起任何外部请求。',
};

export function StoresPage() {
  const workspace = useActiveWorkspace();
  const workspaceId = workspace?.publicId ?? null;
  const canManage = useCanManage();
  const [createOpen, setCreateOpen] = useState(false);
  const [preset, setPreset] = useState<StoreType>('apple');

  const listQuery = useQuery({
    queryKey: qk.connections(workspaceId ?? '', { pageSize: 100 }),
    queryFn: () => fetchStoreConnections({ pageSize: 100 }, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const grouped = (storeType: StoreType) => listQuery.data?.items.filter((item) => item.storeType === storeType) ?? [];

  return (
    <div>
      <PageHeader
        title="市场连接"
        description="保存各市场的官方 API 凭据。凭据加密存储，仅在采集时解密使用。"
        meta="仅使用官方接口；不支持的小米 / OPPO / vivo 暂未开放"
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setPreset('apple');
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> 添加凭据
            </Button>
          ) : null
        }
      />

      {listQuery.isError ? (
        <ErrorBlock message="市场连接加载失败" onRetry={() => listQuery.refetch()} />
      ) : listQuery.isLoading ? (
        <LoadingBlock rows={3} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {SUPPORTED_STORES.map((storeType) => {
            const items = grouped(storeType);
            return (
              <SectionCard
                key={storeType}
                title={STORE_LABELS[storeType] ?? storeType}
                description={STORE_HINTS[storeType]}
                action={
                  canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPreset(storeType);
                        setCreateOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> 添加
                    </Button>
                  ) : null
                }
              >
                {items.length ? (
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={`/app/stores/${item.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/40"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.storeAppCount} 个绑定
                              {item.lastValidatedAt ? ` · 校验于 ${formatRelative(item.lastValidatedAt)}` : ' · 未校验'}
                            </p>
                          </div>
                          <ConnectionStatusBadge status={item.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground">
                    <PlugZap className="h-4 w-4" /> 尚未配置凭据
                  </div>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{STORE_DOCS[storeType]}</p>
              </SectionCard>
            );
          })}
        </div>
      )}

      <SectionCard title="凭据安全" className="mt-5">
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-600" /> 凭据使用 AES-256-GCM 加密存储，接口只返回掩码预览。
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-600" /> 采集工作进程仅通过任务 ID 获取凭据，凭据不会出现在任务负载或日志中。
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-600" /> 校验失败时连接会被标记为「异常」，相关采集暂停直到重新校验成功。
          </li>
        </ul>
      </SectionCard>

      <CreateConnectionDialog open={createOpen} onClose={() => setCreateOpen(false)} preset={preset} workspaceId={workspaceId as string} />
    </div>
  );
}

function CreateConnectionDialog({
  open,
  onClose,
  preset,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  preset: StoreType;
  workspaceId: string;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [storeType, setStoreType] = useState<StoreType>(preset);
  const [name, setName] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // keep dialog in sync with preset when reopened
  const [lastPreset, setLastPreset] = useState<StoreType | null>(null);
  if (preset !== lastPreset && open) {
    setLastPreset(preset);
    setStoreType(preset);
    setFields({});
    setError(null);
  }

  const mutation = useMutation({
    mutationFn: () =>
      createStoreConnection(
        {
          storeType,
          name: name.trim() || STORE_LABELS[storeType],
          credentials: storeType === 'mock' ? { kind: 'mock' } : fields,
        },
        workspaceId,
      ),
    onSuccess: () => {
      toast.push('success', '凭据已保存');
      queryClient.invalidateQueries({ queryKey: ['store-connections'] });
      onClose();
      setName('');
      setFields({});
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : '保存失败'),
  });

  function submit() {
    if (!name.trim()) {
      setError('请填写凭据名称');
      return;
    }
    if (storeType !== 'mock') {
      const required = CREDENTIAL_FIELDS[storeType];
      const missing = required.find((field) => !fields[field.key]?.trim());
      if (missing) {
        setError(`请填写 ${missing.label}`);
        return;
      }
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Dialog open={open} onClose={onClose} title="添加市场凭据" description="凭据只用于调用官方接口，保存后将以密文形式存储。">
      <div className="space-y-4">
        <div>
          <Label htmlFor="conn-store">市场</Label>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_STORES.map((store) => (
              <button
                key={store}
                type="button"
                onClick={() => {
                  setStoreType(store);
                  setFields({});
                  setError(null);
                }}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  storeType === store ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {STORE_LABELS[store] ?? store}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="conn-name">凭据名称</Label>
          <Input
            id="conn-name"
            value={name}
            placeholder={`例如：${STORE_LABELS[storeType]} 生产账号`}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {storeType === 'mock' ? (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            演示商店无需填写凭据，保存后即可绑定并采集模拟评价。
          </p>
        ) : (
          CREDENTIAL_FIELDS[storeType].map((field) => (
            <div key={field.key}>
              <Label htmlFor={`cred-${field.key}`} hint={field.hint}>
                {field.label}
              </Label>
              {field.multiline ? (
                <Textarea
                  id={`cred-${field.key}`}
                  rows={4}
                  value={fields[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(event) => setFields({ ...fields, [field.key]: event.target.value })}
                />
              ) : (
                <Input
                  id={`cred-${field.key}`}
                  value={fields[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(event) => setFields({ ...fields, [field.key]: event.target.value })}
                />
              )}
            </div>
          ))
        )}

        <FieldError message={error ?? undefined} />
        <p className="text-[11px] text-muted-foreground">
          保存后可连接详情页执行「验证连接」，校验通过才会开始采集。
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button loading={mutation.isPending} onClick={submit}>
            保存凭据
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

type CredentialField = { key: string; label: string; hint?: string; placeholder?: string; multiline?: boolean };

const CREDENTIAL_FIELDS: Record<Exclude<StoreType, 'mock'>, CredentialField[]> = {
  apple: [
    { key: 'issuerId', label: 'Issuer ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { key: 'keyId', label: 'Key ID', placeholder: 'ABC123DEFG' },
    {
      key: 'privateKey',
      label: '私钥（.p8 内容）',
      hint: '包含 BEGIN PRIVATE KEY 行',
      placeholder: '-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----',
      multiline: true,
    },
  ],
  google: [
    { key: 'clientEmail', label: 'client_email', placeholder: 'xxx@xxx.iam.gserviceaccount.com' },
    {
      key: 'privateKey',
      label: 'private_key',
      hint: '服务账号 JSON 中的 private_key',
      placeholder: '-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----',
      multiline: true,
    },
  ],
  huawei: [
    { key: 'clientId', label: 'Client ID', placeholder: '100000000' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: '••••••••', multiline: false },
  ],
  xiaomi: [],
  oppo: [],
  vivo: [],
} as Record<Exclude<StoreType, 'mock'>, CredentialField[]>;
