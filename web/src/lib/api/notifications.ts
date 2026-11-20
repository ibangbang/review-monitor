import { requestData, requestList } from './client';
import type { NotificationChannel, NotificationHistoryItem, NotificationRule } from '@/types/api';

export function fetchChannels(workspaceId: string) {
  return requestData<NotificationChannel[]>('/notification-channels', { workspaceId });
}

export function createChannel(
  input: { channelType: 'telegram' | 'webhook'; name: string; config: Record<string, unknown> },
  workspaceId: string,
) {
  return requestData<NotificationChannel>('/notification-channels', { method: 'POST', body: input, workspaceId });
}

export function updateChannel(id: string, input: { name?: string; config?: Record<string, unknown>; enabled?: boolean }, workspaceId: string) {
  return requestData<NotificationChannel>(`/notification-channels/${id}`, { method: 'PATCH', body: input, workspaceId });
}

export function deleteChannel(id: string, workspaceId: string) {
  return requestData<void>(`/notification-channels/${id}`, { method: 'DELETE', workspaceId });
}

export function testChannel(id: string, workspaceId: string) {
  return requestData<{ sent: boolean; message?: string }>(`/notification-channels/${id}/test`, {
    method: 'POST',
    workspaceId,
  });
}

export function fetchRules(workspaceId: string) {
  return requestData<NotificationRule[]>('/notification-rules', { workspaceId });
}

export type RuleInput = {
  name: string;
  eventType: string;
  minRating?: number | null;
  maxRating?: number | null;
  applicationIds?: string[] | null;
  channelIds?: string[] | null;
  enabled?: boolean;
};

export function createRule(input: RuleInput, workspaceId: string) {
  return requestData<NotificationRule>('/notification-rules', { method: 'POST', body: input, workspaceId });
}

export function updateRule(id: string, input: Partial<RuleInput>, workspaceId: string) {
  return requestData<NotificationRule>(`/notification-rules/${id}`, { method: 'PATCH', body: input, workspaceId });
}

export function deleteRule(id: string, workspaceId: string) {
  return requestData<void>(`/notification-rules/${id}`, { method: 'DELETE', workspaceId });
}

export function fetchNotificationHistory(params: { status?: string; eventType?: string; page?: number; pageSize?: number }, workspaceId: string) {
  return requestList<NotificationHistoryItem>('/notification-history', { workspaceId, ...params });
}
