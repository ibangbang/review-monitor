export type WorkerErrorClass = 'retryable' | 'permanent';

export class WorkerError extends Error {
  readonly code: string;
  readonly errorClass: WorkerErrorClass;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    errorClass: WorkerErrorClass = 'retryable',
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'WorkerError';
    this.code = code;
    this.errorClass = errorClass;
    this.details = details;
  }

  static permanent(code: string, message: string, details?: Record<string, unknown>): WorkerError {
    return new WorkerError(code, message, 'permanent', details);
  }

  static retryable(code: string, message: string, details?: Record<string, unknown>): WorkerError {
    return new WorkerError(code, message, 'retryable', details);
  }
}

const PERMANENT_CODES = new Set([
  'STORE_APP_NOT_FOUND',
  'STORE_APP_PAUSED',
  'STORE_CONNECTION_REQUIRED',
  'STORE_CONNECTION_NOT_FOUND',
  'STORE_CONNECTION_INVALID',
  'STORE_CONNECTION_DISABLED',
  'STORE_TYPE_UNSUPPORTED',
  'STORE_AUTH_FAILED',
  'STORE_APP_NOT_EXIST',
  'STORE_PERMISSION_DENIED',
  'CREDENTIAL_DECRYPT_FAILED',
]);

const AUTH_HINTS = /(401|403|unauthor|forbidden|invalid[_ ]?grant|invalid[_ ]?token|permission|credential)/i;

export function classifyHttpStatus(status: number): WorkerErrorClass {
  if (status === 408 || status === 425 || status === 429) return 'retryable';
  if (status >= 500) return 'retryable';
  if (status === 401 || status === 403) return 'permanent';
  return status >= 400 ? 'permanent' : 'retryable';
}

export function toWorkerError(error: unknown, fallbackCode = 'WORKER_UNEXPECTED_ERROR'): WorkerError {
  if (error instanceof WorkerError) return error;
  if (error instanceof Error) {
    const message = error.message || error.name;
    if (PERMANENT_CODES.has(fallbackCode)) {
      return new WorkerError(fallbackCode, message, 'permanent');
    }
    if (AUTH_HINTS.test(message)) {
      return new WorkerError(fallbackCode, message, 'permanent');
    }
    return new WorkerError(fallbackCode, message, 'retryable');
  }
  return new WorkerError(fallbackCode, String(error), 'retryable');
}

export function clampErrorMessage(message: string, max = 500): string {
  const normalized = message.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}
