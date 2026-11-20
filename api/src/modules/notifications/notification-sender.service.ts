import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
}

export type ChannelConfig = Record<string, unknown>;

const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return PRIVATE_IPV4.some((pattern) => pattern.test(address)) || address === '255.255.255.255';
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true;
    if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return PRIVATE_IPV4.some((pattern) => pattern.test(mapped[1]));
    return false;
  }
  return true;
}

/**
 * Delivers notification payloads. Webhook targets are resolved and checked
 * against private address ranges to prevent SSRF from user-supplied URLs.
 */
@Injectable()
export class NotificationSenderService {
  async send(config: ChannelConfig, payload: Record<string, unknown>): Promise<DeliveryResult> {
    if (typeof config.botToken === 'string' && typeof config.chatId === 'string') {
      return this.sendTelegram(config.botToken, config.chatId, this.formatTelegramText(payload));
    }
    if (typeof config.url === 'string') {
      return this.sendWebhook(config.url, payload, typeof config.secret === 'string' ? config.secret : undefined);
    }
    return { success: false, errorCode: 'INVALID_CHANNEL_CONFIG', errorMessage: 'Unsupported channel config' };
  }

  async assertSafeUrl(rawUrl: string): Promise<URL> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new Error('Invalid webhook URL');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Webhook URL must use http or https');
    }
    if (url.username || url.password) {
      throw new Error('Webhook URL must not embed credentials');
    }
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) {
      throw new Error('Webhook URL must not target internal hosts');
    }
    if (isIP(hostname)) {
      if (isPrivateAddress(hostname)) {
        throw new Error('Webhook URL must not target private addresses');
      }
      return url;
    }
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
      throw new Error('Webhook URL must not resolve to private addresses');
    }
    return url;
  }

  private async sendTelegram(botToken: string, chatId: string, text: string): Promise<DeliveryResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: controller.signal,
      });
      if (response.ok) return { success: true, statusCode: response.status };
      const body = await response.text().catch(() => '');
      return {
        success: false,
        statusCode: response.status,
        errorCode: 'TELEGRAM_SEND_FAILED',
        errorMessage: body.slice(0, 300) || response.statusText,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'TELEGRAM_REQUEST_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async sendWebhook(
    rawUrl: string,
    payload: Record<string, unknown>,
    secret?: string,
  ): Promise<DeliveryResult> {
    let url: URL;
    try {
      url = await this.assertSafeUrl(rawUrl);
    } catch (error) {
      return {
        success: false,
        errorCode: 'WEBHOOK_URL_REJECTED',
        errorMessage: error instanceof Error ? error.message : 'Invalid webhook URL',
      };
    }
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (secret) {
      headers['x-reviewmonitor-signature'] = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
        signal: controller.signal,
      });
      if (response.status >= 200 && response.status < 300) {
        return { success: true, statusCode: response.status };
      }
      const text = await response.text().catch(() => '');
      return {
        success: false,
        statusCode: response.status,
        errorCode: 'WEBHOOK_SEND_FAILED',
        errorMessage: text.slice(0, 300) || response.statusText,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'WEBHOOK_REQUEST_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private formatTelegramText(payload: Record<string, unknown>): string {
    const lines: string[] = [];
    const title = typeof payload.title === 'string' ? payload.title : 'ReviewMonitor';
    lines.push(`【${title}】`);
    if (typeof payload.message === 'string') lines.push(payload.message);
    if (typeof payload.rating === 'number') lines.push(`评分：${'★'.repeat(payload.rating)}${'☆'.repeat(5 - payload.rating)}`);
    if (typeof payload.applicationName === 'string') lines.push(`应用：${payload.applicationName}`);
    if (typeof payload.storeType === 'string') lines.push(`市场：${payload.storeType}`);
    if (typeof payload.url === 'string') lines.push(payload.url);
    return lines.join('\n');
  }
}
