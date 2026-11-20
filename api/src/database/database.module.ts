import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ENTITIES } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DATABASE_HOST', '127.0.0.1'),
        port: Number(config.get<string>('DATABASE_PORT', '3306')),
        username: config.get<string>('DATABASE_USER', 'root'),
        password: config.get<string>('DATABASE_PASSWORD', ''),
        database: config.get<string>('DATABASE_NAME', 'reviewmonitor'),
        charset: 'utf8mb4_0900_ai_ci',
        timezone: config.get<string>('DATABASE_TIMEZONE', 'Z'),
        entities: ENTITIES,
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        logging: config.get<string>('DATABASE_LOGGING') === 'true',
        extra: {
          supportBigNumbers: true,
          bigNumberStrings: true,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
