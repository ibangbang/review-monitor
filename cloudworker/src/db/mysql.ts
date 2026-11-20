import { loadConfig } from '../config/env';
import { createPool, Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type SqlParam = string | number | Date | Buffer | null;
export type SqlParams = SqlParam[];

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const config = loadConfig();
  pool = createPool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    connectionLimit: config.database.poolSize,
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 10000,
    timezone: config.database.timezone,
    supportBigNumbers: true,
    bigNumberStrings: true,
    charset: 'utf8mb4',
  }) as unknown as Pool;
  return pool;
}

export async function query<T extends RowDataPacket>(sql: string, params: SqlParams = []): Promise<T[]> {
  const [rows] = await getPool().query<T[]>(sql, params);
  return rows;
}

export async function execute(sql: string, params: SqlParams = []): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(handler: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // rollback 失败时保留原始错误
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}

export async function ping(): Promise<number> {
  const started = Date.now();
  await query<RowDataPacket>('SELECT 1 AS ok');
  return Date.now() - started;
}

export type { RowDataPacket, ResultSetHeader, PoolConnection };
