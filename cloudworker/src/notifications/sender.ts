import { createHmac } from 'node:crypto';
import { WorkerError, classifyHttpStatus } from '../utils/errors';
import { assertSafeUrl } from './ssrf';

export type TelegramConfig = { botToken: string; chatId: string };
export type WebhookConfig = { url: string; secret?: string | null };
export type ChannelConfig = TelegramConfig | WebhookConfig;

export type NotificationPayload = {
  eventType: string;
  title: string;
  message: string;
  url?: string | null;
  fields?: Array<{ label: string; value: string }>;
};

const TELEGRAM_BASE = process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTelegramText(payload: NotificationPayload): string {
  const lines = [`<b>${escapeHtml(payload.title)}</b>`, escapeHtml(payload.message)];
  for (const field of payload.fields ?? []) {
    lines.push(`${escapeHtml(field.label)}: ${escapeHtml(field.value)}`);
  }
  if (payload.url) lines.push(payload.url);
  return lines.join('\n');
}

function timeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

export async function sendNotification(
  channelType: string,
  config: ChannelConfig,
  payload: NotificationPayload,
  timeoutMs = 10000,
): Promise<void> {
  if (channelType === 'telegram') {
    const telegram = config as TelegramConfig;
    if (!telegram.botToken || !telegram.chatId) {
      throw WorkerError.permanent('NOTIFICATION_CONFIG_INVALID', 'Telegram 配置缺少 botToken 或 chatId');
    }
    const response = await fetch(`${TELEGRAM_BASE}/bot${telegram.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram.chatId,
        text: renderTelegramText(payload),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: timeout(timeoutMs),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const retryAfter = response.headers.get('retry-after');
      const message = `Telegram 发送失败 ${response.status}: ${text.slice(0, 200)}${
        retryAfter ? ` (retry-after=${retryAfter})` : ''
      }`;
      throw new WorkerError(
        response.status === 429 ? 'NOTIFICATION_RATE_LIMITED' : 'NOTIFICATION_SEND_FAILED',
        message,
        response.status >= 500 || response.status === 429 ? 'retryable' : 'permanent',
      );
    }
    return;
  }

  if (channelType === 'webhook') {
    const webhook = config as WebhookConfig;
    if (!webhook.url) {
      throw WorkerError.permanent('NOTIFICATION_CONFIG_INVALID', 'Webhook 配置缺少 url');
    }
    const url = await assertSafeUrl(webhook.url);
    const body = JSON.stringify({
      type: payload.eventType,
      title: payload.title,
      message: payload.message,
      url: payload.url ?? null,
      fields: payload.fields ?? [],
      sentAt: new Date().toISOString(),
    });
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'ReviewMonitor/1.0 (+notification-worker)',
    };
    if (webhook.secret) {
      headers['x-reviewmonitor-signature'] = `sha256=${createHmac('sha256', webhook.secret).update(body).digest('hex')}`;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: timeout(timeoutMs),
    });
    if (response.status >= 300 && response.status < 400) {
      throw WorkerError.permanent('NOTIFICATION_REDIRECT_REJECTED', 'Webhook 返回重定向，已拒绝');
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new WorkerError(
        'NOTIFICATION_SEND_FAILED',
        `Webhook 发送失败 ${response.status}: ${text.slice(0, 200)}`,
        classifyHttpStatus(response.status),
      );
    }
    return;
  }

  throw WorkerError.permanent('NOTIFICATION_CHANNEL_UNSUPPORTED', `不支持的通知渠道: ${channelType}`);
}
