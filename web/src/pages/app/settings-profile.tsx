import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/store/session';
import { updateProfile } from '@/lib/api/auth';
import { qk } from '@/lib/queryKeys';
import { PageHeader, SectionCard } from '@/components/common/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = { owner: '拥有者', admin: '管理员', member: '成员' };

export function SettingsProfilePage() {
  const user = useSession((state) => state.user);
  const workspaces = useSession((state) => state.workspaces);
  const setUser = useSession((state) => state.setUser);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
  }, [user?.displayName]);

  const mutation = useMutation({
    mutationFn: () => updateProfile({ displayName: displayName.trim() }),
    onSuccess: (nextUser) => {
      setUser(nextUser);
      queryClient.invalidateQueries({ queryKey: qk.me });
      toast.push('success', '个人资料已更新');
    },
    onError: (cause: unknown) => setError(cause instanceof Error ? cause.message : '保存失败'),
  });

  return (
    <div>
      <PageHeader title="个人资料" description="管理你的显示名称与工作区成员身份。" />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title="基本信息" description="显示名称会展示在评价备注与团队成员列表中。">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              if (displayName.trim().length < 1) {
                setError('显示名称不能为空');
                return;
              }
              mutation.mutate();
            }}
          >
            <div>
              <Label htmlFor="displayName">显示名称</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={60}
                placeholder="例如：张明"
              />
            </div>
            <div>
              <Label htmlFor="email" hint="邮箱用于登录，当前版本不支持修改">
                登录邮箱
              </Label>
              <Input id="email" value={user?.email ?? ''} readOnly disabled />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex items-center gap-2">
              <Button type="submit" loading={mutation.isPending}>
                保存修改
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDisplayName(user?.displayName ?? '')}
                disabled={mutation.isPending}
              >
                重置
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="工作区成员身份" description={`账号创建于 ${user ? formatDate(user.createdAt) : '—'}`}>
          <ul className="divide-y">
            {workspaces.map((workspace) => (
              <li key={workspace.publicId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <div>
                  <p className="text-sm font-medium">{workspace.name}</p>
                  <p className="text-[11px] text-muted-foreground">加入于 {formatDate(workspace.joinedAt)}</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {ROLE_LABELS[workspace.role] ?? workspace.role}
                </span>
              </li>
            ))}
            {!workspaces.length ? <li className="py-3 text-xs text-muted-foreground">尚未加入任何工作区</li> : null}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
