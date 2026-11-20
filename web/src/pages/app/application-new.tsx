import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useActiveWorkspace } from '@/store/session';
import { createApplication } from '@/lib/api/applications';
import { PageHeader, SectionCard } from '@/components/common/page';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Link } from 'react-router-dom';

export function ApplicationNewPage() {
  const workspace = useActiveWorkspace();
  const workspaceId = workspace?.publicId ?? null;
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    name: '',
    bundleId: '',
    packageName: '',
    iconUrl: '',
    description: '',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createApplication(
        {
          name: form.name.trim(),
          bundleId: form.bundleId.trim() || null,
          packageName: form.packageName.trim() || null,
          iconUrl: form.iconUrl.trim() || null,
          description: form.description.trim() || null,
        },
        workspaceId as string,
      ),
    onSuccess: (app) => {
      toast.push('success', '应用已创建，接下来绑定市场条目');
      navigate(`/app/applications/${app.id}`, { replace: true });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : '创建失败');
    },
  });

  function submit() {
    if (!form.name.trim()) {
      setError('请填写应用名称');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/app/applications" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回应用列表
      </Link>

      <PageHeader title="新增应用" description="应用是评价的业务主体，创建后再为它绑定各市场的商店条目。" />

      <SectionCard title="基础信息">
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" hint="用户可见名称">
              应用名称
            </Label>
            <Input
              id="name"
              value={form.name}
              maxLength={120}
              placeholder="例如：专注番茄钟"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bundleId" hint="iOS 可选">
                Bundle ID
              </Label>
              <Input
                id="bundleId"
                value={form.bundleId}
                placeholder="com.example.focus"
                onChange={(event) => setForm({ ...form, bundleId: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="packageName" hint="Android 可选">
                Package Name
              </Label>
              <Input
                id="packageName"
                value={form.packageName}
                placeholder="com.example.focus"
                onChange={(event) => setForm({ ...form, packageName: event.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="iconUrl">图标链接</Label>
            <Input
              id="iconUrl"
              value={form.iconUrl}
              placeholder="https://…"
              onChange={(event) => setForm({ ...form, iconUrl: event.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="description">备注</Label>
            <Textarea
              id="description"
              rows={3}
              maxLength={500}
              value={form.description}
              placeholder="内部说明，例如版本节奏、负责人"
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>

          <FieldError message={error ?? undefined} />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate('/app/applications')}>
              取消
            </Button>
            <Button onClick={submit} loading={mutation.isPending}>
              创建应用
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
