import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useSession } from '@/store/session';
import { logout } from '@/lib/api/auth';
import { PageHeader, SectionCard, InfoRow } from '@/components/common/page';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export function SettingsSecurityPage() {
  const user = useSession((state) => state.user);
  const clear = useSession((state) => state.clear);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clear();
      queryClient.clear();
      toast.push('info', '已退出登录');
      navigate('/login', { replace: true });
    },
  });

  return (
    <div>
      <PageHeader title="安全设置" description="登录会话与凭据安全说明。" />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title="登录会话" description="Web 端使用 HttpOnly Cookie 维持会话，刷新令牌自动轮换。">
          <dl className="space-y-3">
            <InfoRow label="当前账号">{user?.email ?? '—'}</InfoRow>
            <InfoRow label="会话存储">HttpOnly Cookie（rm_access / rm_refresh），页面脚本不可读取</InfoRow>
            <InfoRow label="访问令牌有效期">15 分钟，过期后自动使用刷新令牌续期</InfoRow>
            <InfoRow label="刷新令牌">30 天，每次使用后立即轮换；检测到重复使用会吊销全部会话</InfoRow>
            <InfoRow label="跨站防护">写操作校验 Origin 白名单，Cookie 为 SameSite=Lax</InfoRow>
          </dl>
          <div className="mt-5 flex items-center gap-2 border-t pt-4">
            <Button variant="destructive" loading={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>
              <LogOut className="h-4 w-4" />
              退出登录
            </Button>
            <span className="text-[11px] text-muted-foreground">退出后当前浏览器会话立即失效。</span>
          </div>
        </SectionCard>

        <SectionCard title="商店凭据" description="API 与 Worker 共用同一套密钥管理策略。">
          <dl className="space-y-3">
            <InfoRow label="加密算法">AES-256-GCM，每条凭据独立 IV</InfoRow>
            <InfoRow label="密钥版本">凭据记录携带密钥版本，支持轮换后平滑迁移</InfoRow>
            <InfoRow label="展示策略">接口仅返回脱敏预览（如 token 后四位），不返回明文</InfoRow>
            <InfoRow label="日志策略">错误与日志中自动过滤密钥、令牌与密文</InfoRow>
            <InfoRow label="联网方式">仅调用 App Store Connect / Google Play / 华为应用市场官方接口</InfoRow>
          </dl>
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-[11px] text-muted-foreground">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            如需更换账号密码或重置凭据，请联系工作区拥有者或平台管理员处理。
          </p>
        </SectionCard>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        本系统不在浏览器本地存储任何令牌或凭据。
      </p>
    </div>
  );
}
