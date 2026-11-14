import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.factory';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv(); // falha cedo se a configuração estiver errada
  const app = await NestFactory.create(AppModule);
  configureApp(app, env);
  app.enableShutdownHooks();
  await app.listen(env.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`API no ar em :${env.PORT}/v1`);
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
