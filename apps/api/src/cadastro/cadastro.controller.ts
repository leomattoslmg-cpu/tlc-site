import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, RequisicaoAutenticada } from '../auth/auth.guard';
import { Permissao, PermissaoGuard } from '../auth/permissao.guard';
import { AppError, Erros } from '../common/errors';
import { RateLimiter } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CaptchaService } from '../site/captcha.service';
import { idSchema, tokenSchema } from '../eventos/eventos.schemas';
import { CadastroInput, cadastroSchema, CriarConviteInput, criarConviteSchema } from './cadastro.schemas';
import { CadastroService } from './cadastro.service';

function usuario(req: RequisicaoAutenticada) {
  if (!req.user) throw Erros.naoAutenticado();
  return req.user;
}

/** Rotas públicas: a pessoa chega pelo QR Code de cadastro. */
@Controller('public/cadastro')
export class CadastroPublicoController {
  private readonly limite = new RateLimiter(10, 60 * 60 * 1000); // 10 cadastros por hora por IP

  constructor(
    private readonly cadastro: CadastroService,
    private readonly captcha: CaptchaService,
  ) {}

  @Get(':token')
  async valido(@Param('token', new ZodValidationPipe(tokenSchema)) token: string) {
    return { valido: await this.cadastro.conviteValido(token) };
  }

  @Post(':token')
  @HttpCode(201)
  async cadastrar(
    @Param('token', new ZodValidationPipe(tokenSchema)) token: string,
    @Body(new ZodValidationPipe(cadastroSchema)) corpo: CadastroInput,
    @Req() req: Request,
  ) {
    this.limite.consumir(req.ip ?? 'anonimo');
    if (!(await this.captcha.verificar(corpo.captcha_token, req.ip))) {
      throw new AppError(422, 'CAPTCHA_INVALID', 'Verificação do captcha falhou', 'Confirme que você não é um robô e tente de novo', [
        { campo: 'captcha_token', mensagem: 'Verificação falhou. Tente de novo.' },
      ]);
    }
    await this.cadastro.cadastrar(token, corpo, req.ip);
    return { status: 'aguardando_aprovacao' };
  }
}

/** Painel: gerar QR de cadastro e aprovar quem se cadastrou. */
@Controller()
@UseGuards(AuthGuard, PermissaoGuard)
export class CadastroAdminController {
  constructor(private readonly cadastro: CadastroService) {}

  @Post('convites')
  @Permissao('usuarios:aprovar')
  criar(@Body(new ZodValidationPipe(criarConviteSchema)) corpo: CriarConviteInput, @Req() req: RequisicaoAutenticada) {
    return this.cadastro.criarConvite(usuario(req), corpo, req.ip);
  }

  @Get('convites')
  @Permissao('usuarios:aprovar')
  async listar() {
    return { data: await this.cadastro.listarConvites() };
  }

  @Delete('convites/:id')
  @HttpCode(204)
  @Permissao('usuarios:aprovar')
  async revogar(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Req() req: RequisicaoAutenticada): Promise<void> {
    await this.cadastro.revogarConvite(usuario(req), id, req.ip);
  }

  @Get('membros-pendentes')
  @Permissao('usuarios:aprovar')
  async pendentes() {
    return { data: await this.cadastro.pendentes() };
  }

  @Post('membros-pendentes/:id/aprovar')
  @HttpCode(204)
  @Permissao('usuarios:aprovar')
  async aprovar(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Req() req: RequisicaoAutenticada): Promise<void> {
    await this.cadastro.aprovar(usuario(req), id, req.ip);
  }

  @Post('membros-pendentes/:id/recusar')
  @HttpCode(204)
  @Permissao('usuarios:aprovar')
  async recusar(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Req() req: RequisicaoAutenticada): Promise<void> {
    await this.cadastro.recusar(usuario(req), id, req.ip);
  }
}
