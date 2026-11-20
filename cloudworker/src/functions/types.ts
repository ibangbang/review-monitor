export type Context = {
  requestId?: string;
  function?: { name?: string; version?: string };
  [key: string]: unknown;
};

export type ReviewWorkerEvent = {
  taskId: string;
  requestId?: string;
};

export type NotificationWorkerEvent = {
  outboxId: string;
  requestId?: string;
};

/** FC 事件可能是字符串化的 JSON，统一解析 */
export function parseEvent<T>(event: unknown): T {
  if (typeof event === 'string') return JSON.parse(event) as T;
  if (event && typeof event === 'object') return event as T;
  throw new Error('INVALID_EVENT: 事件体为空或类型不支持');
}
