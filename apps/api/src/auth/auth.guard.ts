import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { Erros } from '../common/errors';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import type { UsuarioAutenticado } from './auth.types';

export type RequisicaoAutenticada = Request & { user?: UsuarioAutenticado };

/** Exige "Authorization: Bearer <token>" válido e com sessão ainda ativa. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly crypto: CryptoService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    const m = /^Bearer (\S+)$/.exec(req.header('authorization') ?? '');
    const payload = m ? this.crypto.verificar(m[1]) : null;
    if (!payload || !(await this.auth.sessaoAtiva(payload.sid))) throw Erros.naoAutenticado();
    req.user = { id: payload.sub, sid: payload.sid, perfis: payload.per ?? [] };
    return true;
  }
}
