import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Erros } from '../common/errors';
import type { RequisicaoAutenticada } from './auth.guard';
import { AuthService } from './auth.service';

const CHAVE = 'permissao_exigida';

/** Uso: @UseGuards(AuthGuard, PermissaoGuard) + @Permissao('eventos:criar'). */
export const Permissao = (p: string) => SetMetadata(CHAVE, p);

@Injectable()
export class PermissaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const exigida = this.reflector.get<string | undefined>(CHAVE, ctx.getHandler());
    if (!exigida) return true;
    const req = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    if (!req.user) throw Erros.naoAutenticado();
    const minhas = await this.auth.permissoes(req.user.id);
    if (!minhas.includes(exigida)) throw Erros.semPermissao();
    return true;
  }
}
