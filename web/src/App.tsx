import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, RequireAuth } from '@/components/layout/app-shell';
import { LoginPage } from '@/pages/auth/login';
import { RegisterPage } from '@/pages/auth/register';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password';
import { OverviewPage } from '@/pages/app/overview';
import { ReviewsPage } from '@/pages/app/reviews';
import { ReviewDetailPage } from '@/pages/app/review-detail';
import { ApplicationsPage } from '@/pages/app/applications';
import { ApplicationNewPage } from '@/pages/app/application-new';
import { ApplicationDetailPage } from '@/pages/app/application-detail';
import { StoresPage } from '@/pages/app/stores';
import { StoreDetailPage } from '@/pages/app/store-detail';
import { NotificationsPage } from '@/pages/app/notifications';
import { AnalyticsPage } from '@/pages/app/analytics';
import { SettingsProfilePage } from '@/pages/app/settings-profile';
import { SettingsWorkspacePage } from '@/pages/app/settings-workspace';
import { SettingsSecurityPage } from '@/pages/app/settings-security';
import { NotFoundPage } from '@/pages/app/not-found';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="/app/overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="reviews/:reviewId" element={<ReviewDetailPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="applications/new" element={<ApplicationNewPage />} />
          <Route path="applications/:applicationId" element={<ApplicationDetailPage />} />
          <Route path="stores" element={<StoresPage />} />
          <Route path="stores/:connectionId" element={<StoreDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings/profile" element={<SettingsProfilePage />} />
          <Route path="settings/workspace" element={<SettingsWorkspacePage />} />
          <Route path="settings/security" element={<SettingsSecurityPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app/overview" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
