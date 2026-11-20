import 'reflect-metadata';
import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ENTITIES } from './entities';

export function createDataSource(): DataSource {
  return new DataSource({
    type: 'mysql',
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    username: process.env.DATABASE_USER ?? 'root',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? 'reviewmonitor',
    charset: 'utf8mb4_0900_ai_ci',
    timezone: process.env.DATABASE_TIMEZONE ?? 'Z',
    entities: ENTITIES,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: process.env.DATABASE_LOGGING === 'true',
    extra: {
      supportBigNumbers: true,
      bigNumberStrings: true,
    },
  });
}

export const AppDataSource = createDataSource();
