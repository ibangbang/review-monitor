import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM envelope for store credentials and notification channel config.
 * Ciphertext format: v1.<iv b64>.<tag b64>.<ciphertext b64>
 */
@Injectable()
export class CredentialCryptoService {
  private readonly key: Buffer;
  readonly keyVersion: number;

  constructor(config: ConfigService) {
    const raw = config.get<string>('CREDENTIAL_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY is required');
    }
    this.key = parseKey(raw);
    this.keyVersion = Number(config.get<string>('CREDENTIAL_KEY_VERSION') ?? '1');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(envelope: string): string {
    const parts = envelope.split('.');
    if (parts.length !== 4 || parts[0] !== VERSION) {
      throw new Error('Unsupported ciphertext envelope');
    }
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const ciphertext = Buffer.from(parts[3], 'base64url');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error('Invalid ciphertext envelope');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Stable SHA-256 fingerprint used to detect credential changes without decrypting. */
  fingerprint(value: unknown): string {
    return createHash('sha256').update(stableStringify(value)).digest('hex');
  }
}

function parseKey(raw: string): Buffer {
  let key: Buffer | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    try {
      const decoded = Buffer.from(raw, 'base64');
      if (decoded.length === 32) key = decoded;
    } catch {
      key = null;
    }
  }
  if (!key) {
    key = createHash('sha256').update(raw, 'utf8').digest();
  }
  return key;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}
