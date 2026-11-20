import { Body, Controller, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Erros } from '../common/errors';
import { RateLimiter } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthGuard, RequisicaoAutenticada } from './auth.guard';
import { AtualizarDadosInput, atualizarDadosSchema, LoginInput, loginSchema, refreshSchema, TrocarSenhaInput, trocarSenhaSchema } from './auth.schemas';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  // Teto por IP. O site (Vercel) chama a API por poucos IPs, então este teto vale para TODOS os membros juntos:
  // precisa ser folgado para um evento com dezenas de pessoas entrando ao mesmo tempo. A proteção contra
  // adivinhar senha é o bloqueio por conta (5 erros = 15 minutos), feito no AuthService.
  private readonly limiteLogin = new RateLimiter(600, 15 * 60 * 1000);

  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) corpo: LoginInput, @Req() req: Request) {
    this.limiteLogin.consumir(req.ip ?? 'anonimo');
    return this.auth.login(corpo, req.ip);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshSchema)) corpo: { refresh_token: string }, @Req() req: Request) {
    return this.auth.renovar(corpo.refresh_token, req.ip);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@Req() req: RequisicaoAutenticada): Promise<void> {
    if (!req.user) throw Erros.naoAutenticado();
    await this.auth.sair(req.user.sid);
  }
}

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  // Quem acertar a senha atual por tentativa e erro é barrado: 5 tentativas a cada 15 minutos.
  private readonly limiteSenha = new RateLimiter(5, 15 * 60 * 1000);

  constructor(private readonly auth: AuthService) {}

  @Get()
  me(@Req() req: RequisicaoAutenticada) {
    if (!req.user) throw Erros.naoAutenticado();
    return this.auth.me(req.user);
  }

  @Post('senha')
  @HttpCode(204)
  async trocarSenha(@Body(new ZodValidationPipe(trocarSenhaSchema)) corpo: TrocarSenhaInput, @Req() req: RequisicaoAutenticada): Promise<void> {
    if (!req.user) throw Erros.naoAutenticado();
    this.limiteSenha.consumir(req.user.id);
    await this.auth.trocarSenha(req.user, corpo.senha_atual, corpo.senha_nova);
  }

  @Patch('dados')
  @HttpCode(204)
  async atualizarDados(@Body(new ZodValidationPipe(atualizarDadosSchema)) corpo: AtualizarDadosInput, @Req() req: RequisicaoAutenticada): Promise<void> {
    if (!req.user) throw Erros.naoAutenticado();
    await this.auth.atualizarDados(req.user, corpo, req.ip);
  }

  @Get('permissoes')
  async permissoes(@Req() req: RequisicaoAutenticada) {
    if (!req.user) throw Erros.naoAutenticado();
    return { data: await this.auth.permissoes(req.user.id) };
  }
}
