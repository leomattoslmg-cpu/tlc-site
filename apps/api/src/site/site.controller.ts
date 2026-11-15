import { Body, Controller, Get, Header, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../common/errors';
import { RateLimiter } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CaptchaService } from './captcha.service';
import { ContatoInput, contatoSchema, slugSchema } from './site.schemas';
import { SiteService } from './site.service';

const CACHE = 'public, max-age=60, stale-while-revalidate=300';

/** Rotas /v1/public/*: não exigem login. */
@Controller('public')
export class SiteController {
  // 5 mensagens por hora por IP
  private readonly limite = new RateLimiter(5, 60 * 60 * 1000);

  constructor(
    private readonly site: SiteService,
    private readonly captcha: CaptchaService,
  ) {}

  @Get('paginas/:slug')
  @Header('Cache-Control', CACHE)
  pagina(@Param('slug', new ZodValidationPipe(slugSchema)) slug: string) {
    return this.site.pagina(slug);
  }

  @Get('eventos')
  @Header('Cache-Control', CACHE)
  async eventos() {
    return { data: await this.site.eventos() };
  }

  @Get('albuns')
  @Header('Cache-Control', CACHE)
  async albuns() {
    return { data: await this.site.albuns() };
  }

  @Post('contato')
  @HttpCode(202)
  async contato(@Body(new ZodValidationPipe(contatoSchema)) corpo: ContatoInput, @Req() req: Request) {
    this.limite.consumir(req.ip ?? 'anonimo');
    if (!(await this.captcha.verificar(corpo.captcha_token, req.ip))) {
      throw new AppError(422, 'CAPTCHA_INVALID', 'Verificação do captcha falhou', 'Confirme que você não é um robô e tente de novo', [
        { campo: 'captcha_token', mensagem: 'Verificação falhou. Tente de novo.' },
      ]);
    }
    await this.site.registrarContato(corpo);
    return { status: 'recebida' };
  }
}
