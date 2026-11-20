import { describe, expect, it } from 'vitest';
import { decryptCredential, encryptCredential, deriveKey, CredentialDecryptError } from '../src/crypto/credential-crypto';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('凭据加密（与 API 兼容的 AES-256-GCM 格式）', () => {
  it('加解密往返一致', () => {
    const payload = JSON.stringify({ clientId: 'abc', secret: 's3cr3t', nested: { n: 1 } });
    const ciphertext = encryptCredential(payload, KEY);
    expect(ciphertext.startsWith('v1.')).toBe(true);
    expect(ciphertext).not.toContain('s3cr3t');
    expect(decryptCredential(ciphertext, KEY)).toBe(payload);
  });

  it('每次加密使用随机 IV', () => {
    const a = encryptCredential('same', KEY);
    const b = encryptCredential('same', KEY);
    expect(a).not.toBe(b);
  });

  it('密文被篡改时抛 CredentialDecryptError', () => {
    const ciphertext = encryptCredential('payload', KEY);
    const parts = ciphertext.split('.');
    const tampered = [parts[0], parts[1], parts[2], Buffer.from('tampered').toString('base64url')].join('.');
    expect(() => decryptCredential(tampered, KEY)).toThrow(CredentialDecryptError);
  });

  it('错误密钥无法解密', () => {
    const other = Buffer.alloc(32, 9).toString('base64');
    const ciphertext = encryptCredential('payload', KEY);
    expect(() => decryptCredential(ciphertext, other)).toThrow(CredentialDecryptError);
  });

  it('支持 64 位 hex 与 passphrase 派生密钥', () => {
    const hex = 'a'.repeat(64);
    expect(deriveKey(hex)).toHaveLength(32);
    expect(deriveKey('passphrase')).toHaveLength(32);
  });
});
