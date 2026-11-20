import 'reflect-metadata';
import { ValidationError, ValidationPipe, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { originCheck } from './common/middleware/origin-check.middleware';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });
  const config = app.get(ConfigService);

  const origins = [
    config.get<string>('WEB_ORIGIN', ''),
    config.get<string>('DASH_ORIGIN', ''),
  ].filter(Boolean);

  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.use(originCheck(origins));
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: flattenValidationErrors(errors),
        }),
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ReviewMonitor API')
    .setDescription('ReviewMonitor Web API v1')
    .setVersion('1.0')
    .addCookieAuth('rm_access')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();
  const port = Number(config.get<string>('API_PORT', '3060'));
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`ReviewMonitor API listening on http://localhost:${port}/api/v1`);
}

function flattenValidationErrors(errors: ValidationError[]): Array<{ field: string; message: string }> {
  const result: Array<{ field: string; message: string }> = [];
  const walk = (items: ValidationError[], prefix: string): void => {
    for (const item of items) {
      const field = prefix ? `${prefix}.${item.property}` : item.property;
      if (item.constraints) {
        for (const message of Object.values(item.constraints)) {
          result.push({ field, message });
        }
      }
      if (item.children?.length) walk(item.children, field);
    }
  };
  walk(errors, '');
  return result;
}

void bootstrap();
