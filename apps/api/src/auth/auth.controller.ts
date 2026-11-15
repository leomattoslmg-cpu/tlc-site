import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Erros } from '../common/errors';
import { RateLimiter } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthGuard, RequisicaoAutenticada } from './auth.guard';
import { LoginInput, loginSchema, refreshSchema } from './auth.schemas';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  // Limite rígido por IP no login (RN: "limite rígido em login"): 20 tentativas a cada 15 minutos.
  private readonly limiteLogin = new RateLimiter(20, 15 * 60 * 1000);

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
  constructor(private readonly auth: AuthService) {}

  @Get()
  me(@Req() req: RequisicaoAutenticada) {
    if (!req.user) throw Erros.naoAutenticado();
    return this.auth.me(req.user);
  }

  @Get('permissoes')
  async permissoes(@Req() req: RequisicaoAutenticada) {
    if (!req.user) throw Erros.naoAutenticado();
    return { data: await this.auth.permissoes(req.user.id) };
  }
}
