import { request, requestData } from './client';
import type { MeResponse, PublicUser, WorkspaceSummary } from '@/types/api';

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
  workspaceName?: string;
};

export type LoginInput = { email: string; password: string };

export async function register(input: RegisterInput) {
  return requestData<{ user: PublicUser; workspacePublicId: string; accessExpiresAt: string }>('/auth/register', {
    method: 'POST',
    body: input,
  });
}

export async function login(input: LoginInput) {
  return requestData<{ user: PublicUser; accessExpiresAt: string }>('/auth/login', {
    method: 'POST',
    body: input,
  });
}

export async function logout() {
  await request('/auth/logout', { method: 'POST' });
}

export async function fetchMe() {
  return requestData<MeResponse>('/auth/me');
}

export async function updateProfile(input: { displayName: string }) {
  return requestData<PublicUser>('/users/me', { method: 'PATCH', body: input });
}

export async function fetchWorkspaces() {
  return requestData<WorkspaceSummary[]>('/workspaces');
}

export async function fetchWorkspace(workspaceId: string) {
  return requestData<WorkspaceSummary>(`/workspaces/${workspaceId}`, { workspaceId });
}

export async function updateWorkspace(workspaceId: string, input: { name: string }) {
  return requestData<WorkspaceSummary>(`/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: input,
    workspaceId,
  });
}

export async function fetchWorkspaceMembers(workspaceId: string) {
  return requestData<
    Array<{ id: string; userId: string; displayName: string | null; email: string; role: string; joinedAt: string }>
  >(`/workspaces/${workspaceId}/members`, { workspaceId });
}
