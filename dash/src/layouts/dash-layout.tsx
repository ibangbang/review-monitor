import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Dropdown, Layout, Menu, Typography } from '@arco-design/web-react';
import {
  IconApps,
  IconDashboard,
  IconFile,
  IconHeart,
  IconLink,
  IconLock,
  IconNotification,
  IconPoweroff,
  IconSchedule,
  IconStar,
  IconUser,
  IconUserGroup,
} from '@arco-design/web-react/icon';
import { adminLogout, fetchAdminMe } from '@/lib/api/admin';

const { Sider, Header, Content } = Layout;

const NAV_ITEMS = [
  { key: '/overview', label: '平台概览', icon: <IconDashboard /> },
  { key: '/users', label: '用户', icon: <IconUser /> },
  { key: '/workspaces', label: '工作区', icon: <IconUserGroup /> },
  { key: '/applications', label: '应用', icon: <IconApps /> },
  { key: '/reviews', label: '评价', icon: <IconStar /> },
  { key: '/tasks', label: '同步任务', icon: <IconSchedule /> },
  { key: '/integrations', label: '商店集成', icon: <IconLink /> },
  { key: '/notifications', label: '通知', icon: <IconNotification /> },
  { key: '/system-health', label: '系统健康', icon: <IconHeart /> },
  { key: '/audit-logs', label: '审计日志', icon: <IconFile /> },
];

export function DashLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: admin } = useQuery({ queryKey: ['admin', 'me'], queryFn: fetchAdminMe, retry: false });

  const selectedKeys = useMemo(() => {
    const match = NAV_ITEMS.filter((item) => location.pathname.startsWith(item.key));
    return match.length ? [match[match.length - 1].key] : ['/overview'];
  }, [location.pathname]);

  const logoutMutation = useMutation({
    mutationFn: adminLogout,
    onSettled: () => {
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  return (
    <Layout className="dash-layout">
      <Sider collapsible breakpoint="xl" width={216}>
        <div className="dash-logo">
          <span className="dash-logo-mark">RM</span>
          <span className="dash-logo-text">ReviewMonitor</span>
        </div>
        <Menu
          selectedKeys={selectedKeys}
          onClickMenuItem={(key) => navigate(key)}
          style={{ width: '100%' }}
        >
          {NAV_ITEMS.map((item) => (
            <Menu.Item key={item.key}>
              {item.icon}
              {item.label}
            </Menu.Item>
          ))}
        </Menu>
      </Sider>
      <Layout>
        <Header className="dash-header">
          <div>
            <Typography.Title heading={6} style={{ margin: 0 }}>
              平台管理后台
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              独立管理员账号体系 · 所有管理操作写入审计日志
            </Typography.Text>
          </div>
          <Dropdown
            droplist={
              <Menu onClickMenuItem={(key) => key === 'logout' && logoutMutation.mutate()}>
                <Menu.Item key="logout">
                  <IconPoweroff style={{ marginRight: 6 }} />
                  退出登录
                </Menu.Item>
              </Menu>
            }
            position="br"
          >
            <div className="dash-admin">
              <Avatar size={28} style={{ backgroundColor: '#165dff' }}>
                {(admin?.displayName ?? admin?.email ?? 'A').slice(0, 1).toUpperCase()}
              </Avatar>
              <div>
                <div className="dash-admin-name">{admin?.displayName ?? '管理员'}</div>
                <div className="dash-admin-email">{admin?.email}</div>
              </div>
              <IconLock style={{ color: 'var(--color-text-3)' }} />
            </div>
          </Dropdown>
        </Header>
        <Content className="dash-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
