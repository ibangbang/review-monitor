import type { StoreType } from '../../../database/entities/store.entities';

export interface ValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface StoreAdapter {
  readonly storeType: StoreType;
  readonly version: string;
  readonly capabilities: string[];
  validateCredentialShape(credentials: Record<string, unknown>): string[];
  validateConnection(credentials: Record<string, unknown>): Promise<ValidationResult>;
}

export const STORE_LABELS: Record<StoreType, string> = {
  apple: 'App Store',
  google: 'Google Play',
  huawei: 'AppGallery',
  xiaomi: 'Xiaomi GetApps',
  oppo: 'OPPO App Market',
  vivo: 'vivo App Store',
  mock: 'Demo Store (mock)',
};

export function requireString(credentials: Record<string, unknown>, field: string): string | null {
  const value = credentials[field];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 10_000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
