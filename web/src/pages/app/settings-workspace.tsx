import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveWorkspace, useCanManage } from '@/store/session';
import { fetchWorkspace, fetchWorkspaceMembers, updateWorkspace } from '@/lib/api/auth';
import { qk } from '@/lib/queryKeys';
import { PageHeader, SectionCard, LoadingBlock, ErrorBlock } from '@/components/common/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = { owner: '拥有者', admin: '管理员', member: '成员' };

export function SettingsWorkspacePage() {
  const workspace = useActiveWorkspace();
  const canManage = useCanManage();
  const queryClient = useQueryClient();
  const toast = useToast();
  const workspaceId = workspace?.publicId ?? null;
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: qk.workspace(workspaceId ?? ''),
    queryFn: () => fetchWorkspace(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const membersQuery = useQuery({
    queryKey: qk.members(workspaceId ?? ''),
    queryFn: () => fetchWorkspaceMembers(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    if (detailQuery.data) setName(detailQuery.data.name);
  }, [detailQuery.data]);

  const mutation = useMutation({
    mutationFn: () => updateWorkspace(workspaceId as string, { name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.me });
      queryClient.invalidateQueries({ queryKey: qk.workspace(workspaceId ?? '') });
      toast.push('success', '工作区名称已更新');
    },
    onError: (cause: unknown) => setError(cause instanceof Error ? cause.message : '保存失败'),
  });

  return (
    <div>
      <PageHeader title="工作区设置" description="管理工作区名称与成员权限。" />

      {detailQuery.isError ? (
        <ErrorBlock message="工作区信息加载失败" onRetry={() => detailQuery.refetch()} />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title="基本信息" description={canManage ? '仅拥有者与管理员可修改。' : '你没有修改工作区设置的权限。'}>
          {detailQuery.isLoading ? (
            <LoadingBlock rows={3} />
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                if (name.trim().length < 1) {
                  setError('工作区名称不能为空');
                  return;
                }
                mutation.mutate();
              }}
            >
              <div>
                <Label htmlFor="workspaceName">工作区名称</Label>
                <Input
                  id="workspaceName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  disabled={!canManage}
                  placeholder="例如：Acme 移动团队"
                />
              </div>
              <div>
                <Label htmlFor="workspaceId">工作区标识</Label>
                <Input id="workspaceId" value={workspaceId ?? ''} readOnly disabled />
              </div>
              {detailQuery.data?.createdAt ? (
                <p className="text-[11px] text-muted-foreground">创建于 {formatDate(detailQuery.data.createdAt)}</p>
              ) : null}
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              {canManage ? (
                <Button type="submit" loading={mutation.isPending}>
                  保存修改
                </Button>
              ) : null}
            </form>
          )}
        </SectionCard>

        <SectionCard title="成员" description={`共 ${membersQuery.data?.length ?? 0} 人`}>
          {membersQuery.isLoading ? (
            <LoadingBlock rows={4} />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>成员</TH>
                  <TH>角色</TH>
                </TR>
              </THead>
              <TBody>
                {(membersQuery.data ?? []).map((member) => (
                  <TR key={member.userPublicId}>
                    <TD>
                      <p className="text-xs font-medium">{member.displayName ?? member.email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {member.email} · 加入于 {formatDate(member.joinedAt)}
                      </p>
                    </TD>
                    <TD className="text-xs">{ROLE_LABELS[member.role] ?? member.role}</TD>
                  </TR>
                ))}
                {!membersQuery.data?.length ? (
                  <TR key="empty">
                    <TD colSpan={2} className="py-6 text-center text-xs text-muted-foreground">
                      暂无成员
                    </TD>
                  </TR>
                ) : null}
              </TBody>
            </Table>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
