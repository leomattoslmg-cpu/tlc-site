import { Body, Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { z } from 'zod';
import { configureApp } from '../src/app.factory';
import { CommonModule } from '../src/common/common.module';
import { ConfigModule } from '../src/config/config.module';
import { IdempotencyInterceptor } from '../src/common/idempotency/idempotency.interceptor';
import { ZodValidationPipe } from '../src/common/zod-validation.pipe';
import { pageQuerySchema, pageResponse, parseSort, PageQuery } from '../src/common/pagination';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { HealthModule } from '../src/health/health.module';

process.env.DATABASE_URL ??= 'postgres://x:x@localhost:5432/x';
process.env.NODE_ENV = 'test';

const corpo = z.object({ nome: z.string().min(2, 'Nome muito curto'), idade: z.number().int().min(13, 'Idade mínima é 13 anos') });

let chamadas = 0;
export const totalChamadas = () => chamadas;

/** Rotas de exemplo que exercitam os padrões da API. */
@Controller('exemplo')
export class ExemploController {
  @Get('lista')
  lista(@Query(new ZodValidationPipe(pageQuerySchema)) q: PageQuery) {
    parseSort(q.sort, ['nome', 'criado_em'], { campo: 'criado_em', direcao: 'desc' });
    return pageResponse([{ id: 1 }], 134, q);
  }

  @Post('validar')
  validar(@Body(new ZodValidationPipe(corpo)) b: z.infer<typeof corpo>) {
    return b;
  }

  @Post('inscricao')
  @UseInterceptors(IdempotencyInterceptor)
  inscricao(@Body() b: Record<string, unknown>) {
    chamadas++;
    if (b.falhar) throw new Error('boom');
    return { id: chamadas, ...b };
  }
}

export async function criarApp(dbOk = true): Promise<INestApplication> {
  const mod = await Test.createTestingModule({
    imports: [ConfigModule, DatabaseModule, CommonModule, HealthModule],
    controllers: [ExemploController],
  })
    .overrideProvider(DatabaseService)
    .useValue({ ping: async () => dbOk })
    .compile();
  const app = mod.createNestApplication();
  configureApp(app, { API_PUBLIC_URL: 'https://api.tlc.test', CORS_ORIGINS: [] });
  await app.init();
  return app;
}
