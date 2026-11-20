import { lookup } from 'node:dns/promises';
import { WorkerError } from '../utils/errors';

const PRIVATE_V4_PATTERNS: Array<[number, number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8
  [0x0a000000, 0xff000000], // 10/8
  [0x7f000000, 0xff000000], // 127/8
  [0xa9fe0000, 0xffff0000], // 169.254/16
  [0xac100000, 0xfff00000], // 172.16/12
  [0xc0a80000, 0xffff0000], // 192.168/16
  [0x64400000, 0xffc00000], // 100.64/10
  [0xffffffff, 0xffffffff], // 255.255.255.255
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = (value << 8) + octet;
  }
  return value >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return false;
  return PRIVATE_V4_PATTERNS.some(([network, mask]) => (value & mask) >>> 0 === (network & mask) >>> 0);
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }
  if (normalized.startsWith('::ffff:')) {
    const embedded = normalized.slice('::ffff:'.length);
    return isPrivateIpv4(embedded);
  }
  return false;
}

function isPrivateAddress(address: string): boolean {
  const family = address.includes(':') ? 6 : 4;
  return family === 4 ? isPrivateIpv4(address) : isPrivateIpv6(address);
}

/**
 * 防止 SSRF：仅允许公网 http(s) 地址，且解析后的所有地址都不能是内网/保留地址。
 */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  // 仅本地联调：允许把 webhook 指向 127.0.0.1 的 sink（生产环境始终生效内网拦截）
  const devBypass = process.env.ALLOW_PRIVATE_WEBHOOKS === 'true' && process.env.NODE_ENV !== 'production';
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw WorkerError.permanent('WEBHOOK_URL_INVALID', 'Webhook 地址格式无效');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw WorkerError.permanent('WEBHOOK_URL_INVALID', 'Webhook 仅支持 http/https 协议');
  }
  if (url.username || url.password) {
    throw WorkerError.permanent('WEBHOOK_URL_INVALID', 'Webhook 地址不能包含认证信息');
  }
  if (devBypass) return url;
  // URL.hostname 对 IPv6 字面量保留方括号，校验前先剥离
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    throw WorkerError.permanent('WEBHOOK_URL_BLOCKED', 'Webhook 地址不能指向本机或内网');
  }
  if (isPrivateAddress(hostname)) {
    throw WorkerError.permanent('WEBHOOK_URL_BLOCKED', 'Webhook 地址不能指向内网');
  }
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && !hostname.includes(':')) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true });
    } catch (error) {
      throw WorkerError.retryable('WEBHOOK_DNS_FAILED', `Webhook 域名解析失败: ${(error as Error).message}`);
    }
    if (!addresses.length) {
      throw WorkerError.retryable('WEBHOOK_DNS_FAILED', 'Webhook 域名解析为空');
    }
    if (addresses.some((item) => isPrivateAddress(item.address))) {
      throw WorkerError.permanent('WEBHOOK_URL_BLOCKED', 'Webhook 域名解析到内网地址');
    }
  }
  return url;
}
