import { useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Spin } from '@arco-design/web-react';
import { fetchAdminMe } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';

export function AdminGuard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: fetchAdminMe,
    retry: false,
  });

  useEffect(() => {
    const handler = () => {
      queryClient.clear();
      navigate('/login', { replace: true });
    };
    window.addEventListener('reviewmonitor-dash:unauthorized', handler);
    return () => window.removeEventListener('reviewmonitor-dash:unauthorized', handler);
  }, [navigate, queryClient]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size={32} tip="加载管理员信息…" />
      </div>
    );
  }

  if (error || !data) {
    const unauthorized = error instanceof ApiError && (error.status === 401 || error.status === 403);
    if (unauthorized) {
      return <Navigate to="/login" replace />;
    }
    return (
      <div style={{ padding: 48 }}>
        <h3>管理员会话校验失败</h3>
        <p style={{ color: 'var(--color-text-2)' }}>{error instanceof Error ? error.message : '未知错误'}</p>
        <a href="/login">返回登录</a>
      </div>
    );
  }

  return <Outlet />;
}
