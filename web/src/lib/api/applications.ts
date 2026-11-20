import { requestData, requestList } from './client';
import type { PublicApplication, PublicStoreApp, StoreType } from '@/types/api';

export type ApplicationListParams = { keyword?: string; status?: string; page?: number; pageSize?: number };

export function fetchApplications(params: ApplicationListParams, workspaceId: string) {
  return requestList<PublicApplication>('/applications', { workspaceId, ...params });
}

export function fetchApplication(id: string, workspaceId: string) {
  return requestData<PublicApplication>(`/applications/${id}`, { workspaceId });
}

export type ApplicationInput = {
  name: string;
  iconUrl?: string | null;
  bundleId?: string | null;
  packageName?: string | null;
  description?: string | null;
};

export function createApplication(input: ApplicationInput, workspaceId: string) {
  return requestData<PublicApplication>('/applications', { method: 'POST', body: input, workspaceId });
}

export function updateApplication(id: string, input: Partial<ApplicationInput> & { status?: string }, workspaceId: string) {
  return requestData<PublicApplication>(`/applications/${id}`, { method: 'PATCH', body: input, workspaceId });
}

export function archiveApplication(id: string, workspaceId: string) {
  return requestData<void>(`/applications/${id}`, { method: 'DELETE', workspaceId });
}

export function fetchStoreApps(applicationId: string, workspaceId: string) {
  return requestData<PublicStoreApp[]>(`/applications/${applicationId}/store-apps`, { workspaceId });
}

export type StoreAppInput = {
  storeType: StoreType;
  externalAppId: string;
  countryCode: string;
  storeConnectionId?: string | null;
  storeUrl?: string | null;
  displayName?: string | null;
  iconUrl?: string | null;
  enabled?: boolean;
  intervalMinutes?: number;
};

export function createStoreApp(applicationId: string, input: StoreAppInput, workspaceId: string) {
  return requestData<PublicStoreApp>(`/applications/${applicationId}/store-apps`, {
    method: 'POST',
    body: input,
    workspaceId,
  });
}

export function updateStoreApp(id: string, input: Partial<StoreAppInput>, workspaceId: string) {
  return requestData<PublicStoreApp>(`/store-apps/${id}`, { method: 'PATCH', body: input, workspaceId });
}

export function deleteStoreApp(id: string, workspaceId: string) {
  return requestData<void>(`/store-apps/${id}`, { method: 'DELETE', workspaceId });
}
