import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, RequisicaoAutenticada } from '../auth/auth.guard';
import { Permissao, PermissaoGuard } from '../auth/permissao.guard';
import { Erros } from '../common/errors';
import { PainelService } from './painel.service';

/** Painel da coordenação: números e gráficos para conferir tudo no próprio site. */
@Controller('painel')
@UseGuards(AuthGuard, PermissaoGuard)
export class PainelController {
  constructor(private readonly painel: PainelService) {}

  @Get()
  @Permissao('dashboard:ler')
  resumo(@Query('ano') ano: string | undefined, @Req() req: RequisicaoAutenticada) {
    if (!req.user) throw Erros.naoAutenticado();
    const n = Number(ano);
    return this.painel.resumo(req.user, Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : undefined);
  }
}
