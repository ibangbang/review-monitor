import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminGuard } from '@/layouts/admin-guard';
import { DashLayout } from '@/layouts/dash-layout';
import { LoginPage } from '@/pages/login';
import { OverviewPage } from '@/pages/overview';
import { UsersPage } from '@/pages/users';
import { WorkspacesPage } from '@/pages/workspaces';
import { ApplicationsPage } from '@/pages/applications';
import { ReviewsPage } from '@/pages/reviews';
import { TasksPage } from '@/pages/tasks';
import { TaskDetailPage } from '@/pages/task-detail';
import { IntegrationsPage } from '@/pages/integrations';
import { NotificationsPage } from '@/pages/notifications';
import { SystemHealthPage } from '@/pages/system-health';
import { AuditLogsPage } from '@/pages/audit-logs';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AdminGuard />}>
        <Route element={<DashLayout />}>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/system-health" element={<SystemHealthPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
