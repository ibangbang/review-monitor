import { Injectable } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import {
  fetchWithTimeout,
  requireString,
  StoreAdapter,
  ValidationResult,
} from './store-adapter.types';

const APP_STORE_CONNECT_HOST = 'https://api.appstoreconnect.apple.com';

@Injectable()
export class AppleStoreAdapter implements StoreAdapter {
  readonly storeType = 'apple' as const;
  readonly version = 'appstoreconnect-v1';
  readonly capabilities = ['reviews.fetch', 'reviews.reply.read'];

  validateCredentialShape(credentials: Record<string, unknown>): string[] {
    const missing: string[] = [];
    if (!requireString(credentials, 'issuerId')) missing.push('issuerId');
    if (!requireString(credentials, 'keyId')) missing.push('keyId');
    if (!requireString(credentials, 'privateKey')) missing.push('privateKey');
    return missing;
  }

  async validateConnection(credentials: Record<string, unknown>): Promise<ValidationResult> {
    const missing = this.validateCredentialShape(credentials);
    if (missing.length) {
      return { valid: false, code: 'CREDENTIAL_FIELDS_MISSING', message: `Missing fields: ${missing.join(', ')}` };
    }

    const issuerId = requireString(credentials, 'issuerId') as string;
    const keyId = requireString(credentials, 'keyId') as string;
    const privateKey = (credentials.privateKey as string).replace(/\\n/g, '\n');

    let token: string;
    try {
      token = sign({}, privateKey, {
        algorithm: 'ES256',
        issuer: issuerId,
        audience: 'appstoreconnect-v1',
        keyid: keyId,
        expiresIn: '15m',
      });
    } catch (error) {
      return {
        valid: false,
        code: 'CREDENTIAL_INVALID_KEY',
        message: error instanceof Error ? error.message.slice(0, 300) : 'Invalid private key',
      };
    }

    try {
      const response = await fetchWithTimeout(`${APP_STORE_CONNECT_HOST}/v1/apps?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) return { valid: true, metadata: { status: response.status } };
      if (response.status === 401 || response.status === 403) {
        return { valid: false, code: 'AUTH_INVALID', message: 'Apple rejected the API key' };
      }
      return {
        valid: false,
        code: 'STORE_REQUEST_FAILED',
        message: `App Store Connect returned HTTP ${response.status}`,
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
