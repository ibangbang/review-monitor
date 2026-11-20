export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return (['debug', 'info', 'warn', 'error'] as LogLevel[]).includes(raw as LogLevel)
    ? (raw as LogLevel)
    : 'info';
}

const SECRET_KEYS = /(secret|token|password|credential|ciphertext|authorization|apikey|api_key)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object' || depth > 4) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEYS.test(key) ? '[redacted]' : redact(item, depth + 1);
  }
  return out;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel()]) return;
  const payload = {
    level,
    time: new Date().toISOString(),
    message,
    ...(meta ? { meta: redact(meta) } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
};
