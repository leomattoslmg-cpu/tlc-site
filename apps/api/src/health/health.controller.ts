import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  /** Vivo? Não toca em dependências, serve para o orquestrador reiniciar o contêiner. */
  @Get()
  @HttpCode(200)
  health() {
    return { status: 'ok' };
  }

  /** Pronto para receber tráfego? Confere o banco; devolve 503 se falhar. */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const banco = await this.db.ping();
    if (!banco) res.status(503);
    return { status: banco ? 'ok' : 'indisponivel', banco: banco ? 'ok' : 'falha' };
  }
}
