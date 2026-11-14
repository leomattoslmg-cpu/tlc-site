import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { Env } from './config/env';
import { ProblemFilter } from './common/problem.filter';

/** Padrões comuns da API; usado pelo main.ts e pelos testes. */
export function configureApp(app: INestApplication, env: Pick<Env, 'API_PUBLIC_URL' | 'CORS_ORIGINS'>): void {
  const express = app as NestExpressApplication;
  express.set('trust proxy', 1); // atrás do proxy do PaaS, para req.ip correto
  express.disable('x-powered-by');
  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGINS,
    exposedHeaders: ['Idempotent-Replayed', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  });
  app.useGlobalFilters(new ProblemFilter(env.API_PUBLIC_URL));
}
