import { request, requestList } from './client';
import type {
  AdminApplication,
  AdminNotification,
  AdminProfile,
  AdminReview,
  AdminTask,
  AdminTaskDetail,
  AdminUser,
  AdminWorkspace,
  AuditLog,
  Integrations,
  Overview,
  SystemHealth,
} from '@/types/admin';

type ListQuery = Record<string, string | number | undefined | null>;

export async function adminLogin(input: { email: string; password: string }) {
  return request<{ admin: AdminProfile; accessExpiresAt: string }>('/admin/auth/login', {
    method: 'POST',
    body: input,
  });
}

export async function adminLogout() {
  await request('/admin/auth/logout', { method: 'POST' });
}

export async function fetchAdminMe() {
  return request<AdminProfile>('/admin/auth/me');
}

export async function fetchOverview() {
  return request<Overview>('/admin/overview');
}

export async function fetchUsers(query: ListQuery) {
  return requestList<AdminUser>('/admin/users', query);
}

export async function fetchWorkspaces(query: ListQuery) {
  return requestList<AdminWorkspace>('/admin/workspaces', query);
}

export async function fetchApplications(query: ListQuery) {
  return requestList<AdminApplication>('/admin/applications', query);
}

export async function fetchReviews(query: ListQuery) {
  return requestList<AdminReview>('/admin/reviews', query);
}

export async function fetchTasks(query: ListQuery) {
  return requestList<AdminTask>('/admin/review-tasks', query);
}

export async function fetchTaskDetail(taskId: string) {
  return request<AdminTaskDetail>(`/admin/review-tasks/${taskId}`);
}

export async function retryTask(taskId: string) {
  return request<{ id: string; status: string }>(`/admin/review-tasks/${taskId}/retry`, { method: 'POST' });
}

export async function fetchIntegrations() {
  return request<Integrations>('/admin/integrations');
}

export async function fetchNotifications(query: ListQuery) {
  return requestList<AdminNotification>('/admin/notifications', query);
}

export async function retryNotification(outboxId: string) {
  return request<{ id: string; status: string }>(`/admin/notifications/${outboxId}/retry`, { method: 'POST' });
}

export async function fetchSystemHealth() {
  return request<SystemHealth>('/admin/system-health');
}

export async function fetchAuditLogs(query: ListQuery) {
  return requestList<AuditLog>('/admin/audit-logs', query);
}
