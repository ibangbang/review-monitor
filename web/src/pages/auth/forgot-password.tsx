import { Link } from 'react-router-dom';
import { AuthLayout } from './auth-layout';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="重置密码"
      description="MVP 阶段暂未开放邮件自助重置。"
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          返回登录
        </Link>
      }
    >
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>
          当前版本不发送重置邮件，避免在未接入邮件服务时给出不可用的入口。若你需要重置密码，请联系工作区所有者或平台管理员处理。
        </p>
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
          后续版本将提供邮箱验证码重置与登录设备管理。
        </div>
        <Link to="/login" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
          我知道了
        </Link>
      </div>
    </AuthLayout>
  );
}
