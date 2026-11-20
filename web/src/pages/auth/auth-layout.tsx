import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 text-slate-100 lg:flex">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-xs font-bold">R</span>
          ReviewMonitor
        </Link>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            把分散在各应用商店的评价，收拢到一个安静的地方。
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            自动采集 App Store、Google Play 与华为应用市场的评价，低星差评即时通知，处理状态与内部备注一目了然。
          </p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>· 官方接口采集，凭据加密存储</li>
            <li>· 低星评价即时推送到 Telegram 或 Webhook</li>
            <li>· 采集新鲜度透明，异常及时暴露</li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} ReviewMonitor</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                R
              </span>
              ReviewMonitor
            </span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6 text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
