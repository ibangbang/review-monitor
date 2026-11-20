import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { login } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { AuthLayout } from './auth-layout';

const schema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => navigate('/app/overview', { replace: true }),
  });

  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  return (
    <AuthLayout
      title="登录 ReviewMonitor"
      description="继续管理你的应用评价。"
      footer={
        <>
          还没有账号？{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            免费注册
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div>
          <Label htmlFor="email">邮箱</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...form.register('email')} />
          <FieldError message={form.formState.errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="password">密码</Label>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...form.register('password')} />
          <FieldError message={form.formState.errors.password?.message} />
        </div>
        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
        <Button type="submit" className="w-full" loading={mutation.isPending}>
          登录
        </Button>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Link to="/forgot-password" className="hover:text-foreground">
            忘记密码？
          </Link>
          <span>使用 Cookie 会话，安全退出请点击右上角</span>
        </div>
      </form>
    </AuthLayout>
  );
}
