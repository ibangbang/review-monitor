import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const FORMAT_VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class CredentialDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialDecryptError';
  }
}

/**
 * 与 API（api/src/common/crypto/credential-crypto.service.ts）保持一致：
 * 密文格式 v1.<iv b64url>.<tag b64url>.<ciphertext b64url>
 * 密钥支持 64 位 hex、base64 的 32 字节，或任意口令（sha256 派生）。
 */
export function deriveKey(rawKey: string): Buffer {
  const trimmed = rawKey.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  const base64 = Buffer.from(trimmed, 'base64');
  if (base64.length === 32 && base64.toString('base64').replace(/=+$/, '') === trimmed.replace(/=+$/, '')) {
    return base64;
  }
  return createHash('sha256').update(trimmed, 'utf8').digest();
}

export function encryptCredential(plaintext: string, rawKey: string): string {
  const key = deriveKey(rawKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT_VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(
    '.',
  );
}

export function decryptCredential(payload: string, rawKey: string): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new CredentialDecryptError('凭证密文格式无效');
  }
  const [, ivPart, tagPart, dataPart] = parts;
  try {
    const key = deriveKey(rawKey);
    const iv = Buffer.from(ivPart, 'base64url');
    const tag = Buffer.from(tagPart, 'base64url');
    const data = Buffer.from(dataPart, 'base64url');
    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
      throw new CredentialDecryptError('凭证密文头无效');
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof CredentialDecryptError) throw error;
    throw new CredentialDecryptError('凭证解密失败，请检查密钥是否与 API 一致');
  }
}
