import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { JsonLogger } from './common/logging/json-logger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: process.env.NODE_ENV === 'production' ? new JsonLogger() : undefined,
  });
  await configureApp(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
