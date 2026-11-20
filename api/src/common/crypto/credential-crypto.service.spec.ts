import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { CredentialCryptoService } from './credential-crypto.service';

const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const config = { get: (name: string) => (name === 'CREDENTIAL_ENCRYPTION_KEY' ? key : undefined) } as unknown as ConfigService;

describe('CredentialCryptoService', () => {
  const crypto = new CredentialCryptoService(config);

  it('round-trips unicode payloads', () => {
    const plain = JSON.stringify({ token: 'abc', note: '评价通知' });
    const encrypted = crypto.encrypt(plain);
    expect(encrypted.startsWith('v1.')).toBe(true);
    expect(encrypted).not.toContain('abc');
    expect(crypto.decrypt(encrypted)).toBe(plain);
  });

  it('produces a different ciphertext for the same plaintext', () => {
    expect(crypto.encrypt('same')).not.toBe(crypto.encrypt('same'));
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = crypto.encrypt('secret');
    const parts = encrypted.split('.');
    const tampered = [parts[0], parts[1], parts[2], Buffer.from('evil').toString('base64url')].join('.');
    expect(() => crypto.decrypt(tampered)).toThrow();
  });

  it('fingerprints objects independent of key order', () => {
    expect(crypto.fingerprint({ a: 1, b: 2 })).toBe(crypto.fingerprint({ b: 2, a: 1 }));
  });

  it('rejects an unsupported key', () => {
    const bad = { get: () => undefined } as unknown as ConfigService;
    expect(() => new CredentialCryptoService(bad)).toThrow('CREDENTIAL_ENCRYPTION_KEY');
  });
});
