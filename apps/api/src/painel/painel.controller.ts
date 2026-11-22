import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, RequisicaoAutenticada } from '../auth/auth.guard';
import { Permissao, PermissaoGuard } from '../auth/permissao.guard';
import { Erros } from '../common/errors';
import { Filtros, PainelService, TIPOS_DETALHE, TipoDetalhe } from './painel.service';

/** Painel da coordenação: números e gráficos para conferir tudo no próprio site. */
@Controller('painel')
@UseGuards(AuthGuard, PermissaoGuard)
export class PainelController {
  constructor(private readonly painel: PainelService) {}

  @Get()
  @Permissao('dashboard:ler')
  resumo(@Query() q: Record<string, string | undefined>, @Req() req: RequisicaoAutenticada) {
    if (!req.user) throw Erros.naoAutenticado();
    return this.painel.resumo(req.user, ano(q.ano), filtros(q));
  }

  /** Dados por trás de cada número ou barra do painel. */
  @Get('detalhe')
  @Permissao('dashboard:ler')
  async detalhe(@Query() q: Record<string, string | undefined>, @Req() req: RequisicaoAutenticada) {
    if (!req.user) throw Erros.naoAutenticado();
    if (!TIPOS_DETALHE.includes(q.tipo as TipoDetalhe)) throw Erros.validacao([{ campo: 'consulta', mensagem: 'Tipo de consulta inválido.' }]);
    const valor = texto(q.valor);
    if (q.tipo === 'evento' && !/^[0-9a-f-]{36}$/i.test(valor ?? '')) throw Erros.validacao([{ campo: 'consulta', mensagem: 'Evento inválido.' }]);
    if (q.tipo === 'mes' && !/^(?:[1-9]|1[0-2])$/.test(valor ?? '')) throw Erros.validacao([{ campo: 'consulta', mensagem: 'Mês inválido.' }]);
    if (q.tipo === 'cadastro_mes' && !/^\d{4}-\d{2}$/.test(valor ?? '')) throw Erros.validacao([{ campo: 'consulta', mensagem: 'Mês inválido.' }]);
    const r = await this.painel.detalhe(req.user, q.tipo as TipoDetalhe, ano(q.ano), filtros(q), valor);
    if (!r) throw Erros.semPermissao();
    return r;
  }
}

function ano(v?: string) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : undefined;
}
function texto(v?: string) {
  const t = (v ?? '').trim();
  return t && t.length <= 120 ? t : undefined;
}
function filtros(q: Record<string, string | undefined>): Filtros {
  return { tlc: texto(q.tlc), comunidade: texto(q.comunidade), cidade: texto(q.cidade) };
}
