import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Boxes,
  Store,
  BellRing,
  BarChart3,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkspaceSwitcher } from './workspace-switcher';

const NAV = [
  { to: '/app/overview', label: '概览', icon: LayoutDashboard },
  { to: '/app/reviews', label: '评价', icon: MessageSquare },
  { to: '/app/applications', label: '应用', icon: Boxes },
  { to: '/app/stores', label: '市场连接', icon: Store },
  { to: '/app/notifications', label: '通知', icon: BellRing },
  { to: '/app/analytics', label: '分析', icon: BarChart3 },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-slate-50/60">
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            R
          </span>
          <span className="text-sm font-semibold tracking-tight">ReviewMonitor</span>
        </div>
        {onClose ? (
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted lg:hidden" aria-label="关闭导航">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="px-3 pb-3">
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-white font-medium text-foreground shadow-subtle ring-1 ring-border'
                  : 'text-muted-foreground hover:bg-white/70 hover:text-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-2">
        <NavLink
          to="/app/settings/profile"
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
              isActive ? 'bg-white font-medium text-foreground shadow-subtle ring-1 ring-border' : 'text-muted-foreground hover:bg-white/70 hover:text-foreground',
            )
          }
        >
          <Settings className="h-4 w-4" />
          设置
        </NavLink>
      </div>
    </aside>
  );
}
