export interface AppEnv {
  NODE_ENV: string;
  API_PORT: number;
  WEB_ORIGIN: string;
  DASH_ORIGIN: string;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ADMIN_SECRET: string;
  ACCESS_TOKEN_TTL: number;
  REFRESH_TOKEN_TTL: number;
  CREDENTIAL_ENCRYPTION_KEY: string;
  CREDENTIAL_KEY_VERSION: number;
  STORE_MOCK_ENABLED: string;
  TELEGRAM_API_BASE: string;
}

const REQUIRED = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_ADMIN_SECRET', 'CREDENTIAL_ENCRYPTION_KEY'];

/** Fail fast at boot rather than issuing tokens with empty secrets. */
export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  for (const key of REQUIRED) {
    const value = env[key];
    if (typeof value !== 'string' || value.trim().length < 16) {
      throw new Error(`${key} must be set and at least 16 characters long`);
    }
  }
  const port = Number(env.API_PORT ?? 3060);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('API_PORT must be a valid port');
  }
  return env;
}
