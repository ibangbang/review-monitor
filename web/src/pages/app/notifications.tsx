import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellPlus, BellRing, Plus, Send, Trash2, Webhook } from 'lucide-react';
import { useActiveWorkspace, useCanManage } from '@/store/session';
import { qk } from '@/lib/queryKeys';
import {
  createChannel,
  createRule,
  deleteChannel,
  deleteRule,
  fetchChannels,
  fetchNotificationHistory,
  fetchRules,
  testChannel,
  updateChannel,
  updateRule,
} from '@/lib/api/notifications';
import { fetchApplications } from '@/lib/api/applications';
import type { NotificationChannel, NotificationRule } from '@/types/api';
import { PageHeader, SectionCard, LoadingBlock } from '@/components/common/page';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { cn, formatDate, formatRelative } from '@/lib/utils';

const EVENT_TYPE_LABELS: Record<string, string> = {
  'review.created': '新评价',
  'review.updated': '评价更新',
  'sync.failed': '同步失败',
  'auth.invalid': '凭据失效',
};

const HISTORY_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' }> = {
  sent: { label: '已发送', tone: 'success' },
  pending: { label: '排队中', tone: 'warning' },
  running: { label: '发送中', tone: 'warning' },
  failed: { label: '发送失败', tone: 'danger' },
  cancelled: { label: '已取消', tone: 'muted' },
};

export function NotificationsPage() {
  const workspace = useActiveWorkspace();
  const workspaceId = workspace?.publicId ?? null;
  const canManage = useCanManage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'channels' | 'rules' | 'history'>('channels');
  const [channelOpen, setChannelOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);

  const channelsQuery = useQuery({
    queryKey: qk.channels(workspaceId ?? ''),
    queryFn: () => fetchChannels(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const rulesQuery = useQuery({
    queryKey: qk.rules(workspaceId ?? ''),
    queryFn: () => fetchRules(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const appsQuery = useQuery({
    queryKey: qk.applications(workspaceId ?? '', { pageSize: 100 }),
    queryFn: () => fetchApplications({ pageSize: 100 }, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const historyQuery = useQuery({
    queryKey: qk.history(workspaceId ?? '', { pageSize: 30 }),
    queryFn: () => fetchNotificationHistory({ pageSize: 30 }, workspaceId as string),
    enabled: Boolean(workspaceId) && tab === 'history',
  });

  const invalidateChannels = () => queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
  const invalidateRules = () => queryClient.invalidateQueries({ queryKey: ['notification-rules'] });

  const testMutation = useMutation({
    mutationFn: (id: string) => testChannel(id, workspaceId as string),
    onSuccess: (result) => {
      if (result.sent) toast.push('success', '测试消息已发送');
      else toast.push('error', result.message ?? '测试发送失败');
      invalidateChannels();
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '测试发送失败'),
  });

  const toggleChannel = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateChannel(id, { enabled }, workspaceId as string),
    onSuccess: invalidateChannels,
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '更新失败'),
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (id: string) => deleteChannel(id, workspaceId as string),
    onSuccess: () => {
      toast.push('success', '渠道已删除');
      invalidateChannels();
      invalidateRules();
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '删除失败'),
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateRule(id, { enabled }, workspaceId as string),
    onSuccess: invalidateRules,
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '更新失败'),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => deleteRule(id, workspaceId as string),
    onSuccess: () => {
      toast.push('success', '规则已删除');
      invalidateRules();
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '删除失败'),
  });

  return (
    <div>
      <PageHeader
        title="通知"
        description="低星评价与同步异常可即时推送到 Telegram 群组或企业 Webhook。"
        meta="通知与采集解耦：发送失败会自动重试，不会影响评价采集"
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => setChannelOpen(true)}>
                <Plus className="h-4 w-4" /> 通知渠道
              </Button>
              <Button onClick={() => setRuleOpen(true)}>
                <BellPlus className="h-4 w-4" /> 通知规则
              </Button>
            </>
          ) : null
        }
      />

      <div className="mb-4 inline-flex rounded-lg border p-0.5 text-xs">
        {[
          { key: 'channels', label: `渠道 ${channelsQuery.data?.length ?? 0}` },
          { key: 'rules', label: `规则 ${rulesQuery.data?.length ?? 0}` },
          { key: 'history', label: '发送记录' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as typeof tab)}
            className={cn(
              'rounded-md px-3 py-1.5 transition-colors',
              tab === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'channels' ? (
        <SectionCard title="通知渠道" description="Telegram 机器人或 Webhook 地址">
          {channelsQuery.isLoading ? (
            <LoadingBlock rows={3} />
          ) : !channelsQuery.data?.length ? (
            <EmptyState
              icon={BellRing}
              title="还没有通知渠道"
              description="添加 Telegram 机器人或 Webhook，即可接收低星评价提醒。"
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setChannelOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> 添加渠道
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y">
              {channelsQuery.data.map((channel: NotificationChannel) => (
                <li key={channel.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {channel.channelType === 'telegram' ? <Send className="h-3.5 w-3.5" /> : <Webhook className="h-3.5 w-3.5" />}
                      </span>
                      <p className="truncate text-sm font-medium">{channel.name}</p>
                      <Badge tone="muted">{channel.channelType === 'telegram' ? 'Telegram' : 'Webhook'}</Badge>
                      {!channel.enabled ? <Badge tone="muted">已停用</Badge> : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {channel.channelType === 'telegram'
                        ? `Chat ${String(channel.configPreview.chatId ?? '—')} · Token ${String(channel.configPreview.botToken ?? '')}`
                        : String(channel.configPreview.url ?? '—')}
                      {channel.lastTestedAt ? ` · 最近测试 ${formatRelative(channel.lastTestedAt)}` : ''}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={channel.enabled}
                        disabled={toggleChannel.isPending}
                        onChange={(next) => toggleChannel.mutate({ id: channel.id, enabled: next })}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        loading={testMutation.isPending && testMutation.variables === channel.id}
                        onClick={() => testMutation.mutate(channel.id)}
                      >
                        测试
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="删除渠道"
                        onClick={() => {
                          if (window.confirm('删除渠道会同时从规则中移除，确认删除？')) deleteChannelMutation.mutate(channel.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      {tab === 'rules' ? (
        <SectionCard title="通知规则" description="按事件与评分范围筛选，可限定应用与渠道">
          {rulesQuery.isLoading ? (
            <LoadingBlock rows={3} />
          ) : !rulesQuery.data?.length ? (
            <EmptyState
              icon={BellPlus}
              title="还没有通知规则"
              description="例如：新评价中 1–2 星，推送到运营群。"
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setRuleOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> 添加规则
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y">
              {rulesQuery.data.map((rule: NotificationRule) => (
                <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{rule.name}</p>
                      <Badge tone="primary">{EVENT_TYPE_LABELS[rule.eventType] ?? rule.eventType}</Badge>
                      {!rule.enabled ? <Badge tone="muted">已停用</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      评分 {rule.minRating ?? 1}–{rule.maxRating ?? 5} 星 ·{' '}
                      {rule.applicationIds?.length ? `${rule.applicationIds.length} 个应用` : '全部应用'} ·{' '}
                      {rule.channelIds?.length ?? channelsQuery.data?.length ?? 0} 个渠道
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.enabled}
                        disabled={toggleRule.isPending}
                        onChange={(next) => toggleRule.mutate({ id: rule.id, enabled: next })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="删除规则"
                        onClick={() => {
                          if (window.confirm('确认删除该规则？')) deleteRuleMutation.mutate(rule.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      {tab === 'history' ? (
        <SectionCard title="发送记录" description="最近 30 条通知投递结果">
          {historyQuery.isLoading ? (
            <LoadingBlock rows={5} />
          ) : !historyQuery.data?.items.length ? (
            <EmptyState icon={BellRing} title="还没有发送记录" description="触发规则后，这里会显示投递结果与失败原因。" />
          ) : (
            <ul className="divide-y">
              {historyQuery.data.items.map((item) => {
                const status = HISTORY_STATUS[item.status] ?? { label: item.status, tone: 'muted' as const };
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{String(item.payload.title ?? item.eventType)}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {item.channel?.name ?? '未知渠道'} · {EVENT_TYPE_LABELS[item.eventType] ?? item.eventType} ·{' '}
                        {formatDate(item.createdAt)}
                      </p>
                      {item.errorMessage ? (
                        <p className="mt-0.5 text-[11px] text-red-600">
                          {item.errorCode}：{item.errorMessage}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {item.attempts}/{item.maxAttempts}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      ) : null}

      <ChannelDialog open={channelOpen} onClose={() => setChannelOpen(false)} workspaceId={workspaceId as string} />
      <RuleDialog
        open={ruleOpen}
        onClose={() => setRuleOpen(false)}
        workspaceId={workspaceId as string}
        channels={channelsQuery.data ?? []}
        applications={appsQuery.data?.items.map((app) => ({ id: app.id, name: app.name })) ?? []}
      />
    </div>
  );
}

function ChannelDialog({ open, onClose, workspaceId }: { open: boolean; onClose: () => void; workspaceId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [channelType, setChannelType] = useState<'telegram' | 'webhook'>('telegram');
  const [name, setName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createChannel(
        {
          channelType,
          name: name.trim() || (channelType === 'telegram' ? 'Telegram 通知' : 'Webhook 通知'),
          config:
            channelType === 'telegram'
              ? { botToken: botToken.trim(), chatId: chatId.trim() }
              : { url: url.trim(), ...(secret.trim() ? { secret: secret.trim() } : {}) },
        },
        workspaceId,
      ),
    onSuccess: () => {
      toast.push('success', '渠道已创建');
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      onClose();
      setName('');
      setBotToken('');
      setChatId('');
      setUrl('');
      setSecret('');
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : '创建失败'),
  });

  function submit() {
    if (channelType === 'telegram') {
      if (!botToken.trim() || !chatId.trim()) {
        setError('请填写 Bot Token 与 Chat ID');
        return;
      }
    } else if (!url.trim()) {
      setError('请填写 Webhook 地址');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Dialog open={open} onClose={onClose} title="添加通知渠道">
      <div className="space-y-4">
        <div>
          <Label>渠道类型</Label>
          <div className="flex gap-2">
            {(['telegram', 'webhook'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setChannelType(type)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs transition-colors',
                  channelType === type ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {type === 'telegram' ? 'Telegram' : 'Webhook'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="ch-name">名称</Label>
          <Input id="ch-name" value={name} placeholder="例如：运营低星群" onChange={(event) => setName(event.target.value)} />
        </div>

        {channelType === 'telegram' ? (
          <>
            <div>
              <Label htmlFor="ch-token" hint="从 @BotFather 获取">
                Bot Token
              </Label>
              <Input
                id="ch-token"
                value={botToken}
                placeholder="123456789:AA…"
                onChange={(event) => setBotToken(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ch-chat" hint="@channel 或数字 chat id">
                Chat ID
              </Label>
              <Input id="ch-chat" value={chatId} placeholder="-1001234567890" onChange={(event) => setChatId(event.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="ch-url">Webhook 地址</Label>
              <Input id="ch-url" value={url} placeholder="https://…" onChange={(event) => setUrl(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="ch-secret" hint="用于 HMAC 签名，可选">
                签名密钥
              </Label>
              <Input
                id="ch-secret"
                value={secret}
                placeholder="留空则不签名"
                onChange={(event) => setSecret(event.target.value)}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              仅支持公网 http(s) 地址，内网与本地地址会被拒绝，避免服务端请求伪造风险。
            </p>
          </>
        )}

        <FieldError message={error ?? undefined} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button loading={mutation.isPending} onClick={submit}>
            保存渠道
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function RuleDialog({
  open,
  onClose,
  workspaceId,
  channels,
  applications,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  channels: NotificationChannel[];
  applications: { id: string; name: string }[];
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('低星评价提醒');
  const [eventType, setEventType] = useState('review.created');
  const [minRating, setMinRating] = useState(1);
  const [maxRating, setMaxRating] = useState(2);
  const [applicationIds, setApplicationIds] = useState<string[]>([]);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createRule(
        {
          name: name.trim(),
          eventType,
          minRating,
          maxRating,
          applicationIds: applicationIds.length ? applicationIds : null,
          channelIds: channelIds.length ? channelIds : null,
          enabled: true,
        },
        workspaceId,
      ),
    onSuccess: () => {
      toast.push('success', '通知规则已创建');
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] });
      onClose();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : '创建失败'),
  });

  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }

  function submit() {
    if (!name.trim()) {
      setError('请填写规则名称');
      return;
    }
    if (minRating > maxRating) {
      setError('最低评分不能高于最高评分');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Dialog open={open} onClose={onClose} title="新增通知规则" description="评分范围与事件共同决定触发条件。">
      <div className="space-y-4">
        <div>
          <Label htmlFor="rule-name">规则名称</Label>
          <Input id="rule-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="rule-event">事件</Label>
            <Select id="rule-event" value={eventType} onChange={(event) => setEventType(event.target.value)}>
              {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rule-min">最低评分</Label>
            <Select id="rule-min" value={String(minRating)} onChange={(event) => setMinRating(Number(event.target.value))}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} 星
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rule-max">最高评分</Label>
            <Select id="rule-max" value={String(maxRating)} onChange={(event) => setMaxRating(Number(event.target.value))}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} 星
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label hint="留空表示全部应用">适用应用</Label>
          <div className="flex flex-wrap gap-2">
            {applications.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setApplicationIds(toggle(applicationIds, app.id))}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs transition-colors',
                  applicationIds.includes(app.id)
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {app.name}
              </button>
            ))}
            {!applications.length ? <span className="text-xs text-muted-foreground">暂无应用</span> : null}
          </div>
        </div>

        <div>
          <Label hint="留空表示全部渠道">发送渠道</Label>
          <div className="flex flex-wrap gap-2">
            {channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => setChannelIds(toggle(channelIds, channel.id))}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs transition-colors',
                  channelIds.includes(channel.id)
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {channel.name}
              </button>
            ))}
            {!channels.length ? (
              <span className="text-xs text-amber-700">还没有渠道，创建后规则才会实际发送</span>
            ) : null}
          </div>
        </div>

        <FieldError message={error ?? undefined} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button loading={mutation.isPending} onClick={submit}>
            保存规则
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
