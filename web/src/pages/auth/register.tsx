import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { register as registerAccount } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { AuthLayout } from './auth-layout';

const schema = z.object({
  displayName: z.string().min(1, '请输入称呼').max(40, '称呼过长'),
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(8, '密码至少 8 位'),
  workspaceName: z.string().max(60, '工作区名称过长').optional(),
});

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', email: '', password: '', workspaceName: '' },
  });

  const mutation = useMutation({
    mutationFn: registerAccount,
    onSuccess: () => navigate('/app/overview', { replace: true }),
  });

  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  return (
    <AuthLayout
      title="创建账号"
      description="几分钟内完成应用接入与评价监控。"
      footer={
        <>
          已有账号？{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            直接登录
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div>
          <Label htmlFor="displayName">你的称呼</Label>
          <Input id="displayName" placeholder="例如：小林" {...form.register('displayName')} />
          <FieldError message={form.formState.errors.displayName?.message} />
        </div>
        <div>
          <Label htmlFor="email">邮箱</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...form.register('email')} />
          <FieldError message={form.formState.errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="password" hint="至少 8 位">
            密码
          </Label>
          <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
          <FieldError message={form.formState.errors.password?.message} />
        </div>
        <div>
          <Label htmlFor="workspaceName" hint="可留空">
            工作区名称
          </Label>
          <Input id="workspaceName" placeholder="默认使用你的称呼" {...form.register('workspaceName')} />
        </div>
        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
        <Button type="submit" className="w-full" loading={mutation.isPending}>
          注册并进入
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          注册即表示你同意平台仅通过官方商店接口采集评价，并将凭据以 AES-256-GCM 加密存储。
        </p>
      </form>
    </AuthLayout>
  );
}
