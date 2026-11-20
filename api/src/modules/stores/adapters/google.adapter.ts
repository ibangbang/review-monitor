import { Injectable } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import {
  fetchWithTimeout,
  requireString,
  StoreAdapter,
  ValidationResult,
} from './store-adapter.types';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

@Injectable()
export class GoogleStoreAdapter implements StoreAdapter {
  readonly storeType = 'google' as const;
  readonly version = 'androidpublisher-v3';
  readonly capabilities = ['reviews.fetch', 'reviews.reply.read'];

  validateCredentialShape(credentials: Record<string, unknown>): string[] {
    const missing: string[] = [];
    if (!requireString(credentials, 'serviceAccountEmail')) missing.push('serviceAccountEmail');
    if (!requireString(credentials, 'privateKey')) missing.push('privateKey');
    return missing;
  }

  async validateConnection(credentials: Record<string, unknown>): Promise<ValidationResult> {
    const missing = this.validateCredentialShape(credentials);
    if (missing.length) {
      return { valid: false, code: 'CREDENTIAL_FIELDS_MISSING', message: `Missing fields: ${missing.join(', ')}` };
    }

    const email = requireString(credentials, 'serviceAccountEmail') as string;
    const privateKey = (credentials.privateKey as string).replace(/\\n/g, '\n');

    let assertion: string;
    try {
      assertion = sign(
        { scope: ANDROID_PUBLISHER_SCOPE, aud: GOOGLE_TOKEN_URL },
        privateKey,
        { algorithm: 'RS256', issuer: email, expiresIn: '1h' },
      );
    } catch (error) {
      return {
        valid: false,
        code: 'CREDENTIAL_INVALID_KEY',
        message: error instanceof Error ? error.message.slice(0, 300) : 'Invalid private key',
      };
    }

    try {
      const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
      });
      if (response.ok) {
        return { valid: true, metadata: { scope: ANDROID_PUBLISHER_SCOPE } };
      }
      const text = await response.text();
      return {
        valid: false,
        code: response.status === 400 || response.status === 401 ? 'AUTH_INVALID' : 'STORE_REQUEST_FAILED',
        message: `Google OAuth returned HTTP ${response.status}: ${text.slice(0, 200)}`,
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
