import { Injectable } from '@nestjs/common';
import {
  fetchWithTimeout,
  requireString,
  StoreAdapter,
  ValidationResult,
} from './store-adapter.types';

const HUAWEI_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';

@Injectable()
export class HuaweiStoreAdapter implements StoreAdapter {
  readonly storeType = 'huawei' as const;
  readonly version = 'agc-connect-v1';
  readonly capabilities = ['reviews.fetch'];

  validateCredentialShape(credentials: Record<string, unknown>): string[] {
    const missing: string[] = [];
    if (!requireString(credentials, 'clientId')) missing.push('clientId');
    if (!requireString(credentials, 'clientSecret')) missing.push('clientSecret');
    return missing;
  }

  async validateConnection(credentials: Record<string, unknown>): Promise<ValidationResult> {
    const missing = this.validateCredentialShape(credentials);
    if (missing.length) {
      return { valid: false, code: 'CREDENTIAL_FIELDS_MISSING', message: `Missing fields: ${missing.join(', ')}` };
    }

    try {
      const response = await fetchWithTimeout(HUAWEI_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: requireString(credentials, 'clientId') as string,
          client_secret: requireString(credentials, 'clientSecret') as string,
        }),
      });
      if (response.ok) return { valid: true };
      const text = await response.text();
      return {
        valid: false,
        code: response.status === 400 || response.status === 401 ? 'AUTH_INVALID' : 'STORE_REQUEST_FAILED',
        message: `Huawei OAuth returned HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
    } catch (error) {
      return {
        valid: false,
        code: 'STORE_UNREACHABLE',
        message: error instanceof Error ? error.message.slice(0, 300) : 'Network error',
      };
    }
  }
}
