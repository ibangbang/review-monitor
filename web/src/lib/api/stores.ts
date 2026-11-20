import { requestData, requestList } from './client';
import type { StoreConnection, StoreType } from '@/types/api';

export type StoreConnectionListParams = { storeType?: StoreType; status?: string; page?: number; pageSize?: number };

export function fetchStoreConnections(params: StoreConnectionListParams, workspaceId: string) {
  return requestList<StoreConnection>('/store-connections', { workspaceId, ...params });
}

export function fetchStoreConnection(id: string, workspaceId: string) {
  return requestData<StoreConnection>(`/store-connections/${id}`, { workspaceId });
}

export function createStoreConnection(
  input: { storeType: StoreType; name?: string; credentials: Record<string, unknown> },
  workspaceId: string,
) {
  return requestData<StoreConnection>('/store-connections', { method: 'POST', body: input, workspaceId });
}

export function updateStoreConnection(
  id: string,
  input: { name?: string; credentials?: Record<string, unknown>; enabled?: boolean },
  workspaceId: string,
) {
  return requestData<StoreConnection>(`/store-connections/${id}`, { method: 'PATCH', body: input, workspaceId });
}

export function deleteStoreConnection(id: string, workspaceId: string) {
  return requestData<void>(`/store-connections/${id}`, { method: 'DELETE', workspaceId });
}

export function validateStoreConnection(id: string, workspaceId: string) {
  return requestData<{ valid: boolean; code?: string; message?: string; metadata?: Record<string, unknown> }>(
    `/store-connections/${id}/validate`,
    { method: 'POST', workspaceId },
  );
}

export const STORE_LABELS: Record<string, string> = {
  apple: 'App Store',
  google: 'Google Play',
  huawei: '华为应用市场',
  xiaomi: '小米应用商店',
  oppo: 'OPPO 软件商店',
  vivo: 'vivo 应用商店',
  mock: '演示商店',
};

export const SUPPORTED_STORES: StoreType[] = ['apple', 'google', 'huawei', 'mock'];
