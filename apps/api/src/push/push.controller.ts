import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthGuard, RequisicaoAutenticada } from '../auth/auth.guard';
import { Erros } from '../common/errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PushService } from './push.service';

const inscreverSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});
type InscreverInput = z.infer<typeof inscreverSchema>;
const cancelarSchema = z.object({ endpoint: z.string().url().max(1000) });

@Controller('push')
@UseGuards(AuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('chave')
  chave() {
    return { chave: this.push.chavePublica() };
  }

  @Post('inscrever')
  @HttpCode(204)
  async inscrever(@Body(new ZodValidationPipe(inscreverSchema)) c: InscreverInput, @Req() req: RequisicaoAutenticada & Request): Promise<void> {
    if (!req.user) throw Erros.naoAutenticado();
    await this.push.inscrever(req.user.id, { endpoint: c.endpoint, p256dh: c.keys.p256dh, auth: c.keys.auth }, req.headers['user-agent']);
  }

  @Post('cancelar')
  @HttpCode(204)
  async cancelar(@Body(new ZodValidationPipe(cancelarSchema)) c: { endpoint: string }, @Req() req: RequisicaoAutenticada): Promise<void> {
    if (!req.user) throw Erros.naoAutenticado();
    await this.push.cancelar(req.user.id, c.endpoint);
  }
}
