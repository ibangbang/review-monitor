import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Menu, User as UserIcon, Settings } from 'lucide-react';
import { fetchMe, logout } from '@/lib/api/auth';
import { qk } from '@/lib/queryKeys';
import { useSession } from '@/store/session';
import { Sidebar } from './sidebar';
import { Button } from '@/components/ui/button';

function UserMenu() {
  const user = useSession((state) => state.user);
  const clear = useSession((state) => state.clear);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clear();
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border bg-background px-2 py-1 text-xs transition-colors hover:bg-muted"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {(user?.displayName ?? user?.email ?? 'U').slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[120px] truncate sm:block">{user?.displayName ?? user?.email}</span>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-md border bg-card py-1 shadow-card">
            <div className="border-b px-3 py-2">
              <p className="truncate text-xs font-medium">{user?.displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
            <Link
              to="/app/settings/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <UserIcon className="h-3.5 w-3.5" /> 个人资料
            </Link>
            <Link
              to="/app/settings/workspace"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" /> 工作区设置
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> 退出登录
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function RequireAuth() {
  const location = useLocation();
  const setSession = useSession((state) => state.setSession);
  const clear = useSession((state) => state.clear);
  const user = useSession((state) => state.user);

  const { data, isLoading, isError } = useQuery({
    queryKey: qk.me,
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data) setSession(data.user, data.workspaces);
  }, [data, setSession]);

  useEffect(() => {
    const handler = () => {
      clear();
    };
    window.addEventListener('reviewmonitor:unauthorized', handler);
    return () => window.removeEventListener('reviewmonitor:unauthorized', handler);
  }, [clear]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          正在加载…
        </div>
      </div>
    );
  }

  if (isError && !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/30" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="relative h-full w-64 bg-background shadow-xl">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="打开导航">
              <Menu className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">评价监控工作台</span>
          </div>
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
