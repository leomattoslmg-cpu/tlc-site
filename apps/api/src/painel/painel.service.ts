import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { OrganizacaoService } from '../database/organizacao.service';

const FUSO = 'America/Campo_Grande';
const ANO_EV = `date_part('year', e.inicio_em AT TIME ZONE '${FUSO}')`;
const ATIVO = `m.organizacao_id = $1 AND m.status = 'ativo' AND m.excluido_em IS NULL AND m.anonimizado_em IS NULL AND m.usuario_id IS NOT NULL`;
const EV_VALIDO = `e.organizacao_id = $1 AND e.excluido_em IS NULL AND e.status NOT IN ('rascunho', 'cancelado') AND ${ANO_EV} = $2`;

interface Contagem { rotulo: string; total: number }

@Injectable()
export class PainelService {
  constructor(
    private readonly db: DatabaseService,
    private readonly organizacao: OrganizacaoService,
    private readonly auth: AuthService,
  ) {}

  async resumo(user: UsuarioAutenticado, anoPedido?: number) {
    const org = await this.organizacao.id();
    const anoAtual = Number((await this.db.query<{ a: number }>(`SELECT date_part('year', now() AT TIME ZONE '${FUSO}')::int AS a`)).rows[0].a);
    const ano = anoPedido ?? anoAtual;
    // Nomes de pessoas só para quem pode ver a lista de membros (Marketing e Tesouraria veem apenas os números).
    const verNomes = (await this.auth.permissoes(user.id)).includes('membros:ler');
    const q = <T extends Record<string, unknown>>(sql: string, p: unknown[] = [org, ano]) => this.db.query<T>(sql, p).then((r) => r.rows);

    const [totais, porTlc, porComunidade, porCidade, eventos, porMes, cadastros, anos] = await Promise.all([
      q<{ participantes: number; pendentes: number; eventos: number; realizados: number; proximos: number; presencas: number; presencas_hoje: number }>(
        `SELECT
           (SELECT count(*) FROM membros m WHERE ${ATIVO})::int AS participantes,
           (SELECT count(*) FROM membros m WHERE m.organizacao_id = $1 AND m.status = 'pendente' AND m.excluido_em IS NULL AND m.anonimizado_em IS NULL AND m.usuario_id IS NOT NULL)::int AS pendentes,
           (SELECT count(*) FROM eventos e WHERE ${EV_VALIDO})::int AS eventos,
           (SELECT count(*) FROM eventos e WHERE ${EV_VALIDO} AND e.fim_em < now())::int AS realizados,
           (SELECT count(*) FROM eventos e WHERE ${EV_VALIDO} AND e.fim_em >= now())::int AS proximos,
           (SELECT count(*) FROM evento_checkins c JOIN eventos e ON e.id = c.evento_id WHERE ${EV_VALIDO})::int AS presencas,
           (SELECT count(*) FROM evento_checkins c JOIN eventos e ON e.id = c.evento_id
             WHERE e.organizacao_id = $1 AND e.excluido_em IS NULL AND e.status <> 'cancelado' AND $2::int IS NOT NULL
               AND (c.registrado_em AT TIME ZONE '${FUSO}')::date = (now() AT TIME ZONE '${FUSO}')::date)::int AS presencas_hoje`,
      ),
      q<Contagem & Record<string, unknown>>(
        `SELECT COALESCE(NULLIF(trim(m.edicao_tlc), ''), 'Não informado') AS rotulo, count(*)::int AS total
           FROM membros m WHERE ${ATIVO} AND $2::int IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 40`,
      ),
      q<Contagem & Record<string, unknown>>(
        `SELECT COALESCE(NULLIF(trim(m.comunidade), ''), 'Não informada') AS rotulo, count(*)::int AS total
           FROM membros m WHERE ${ATIVO} AND $2::int IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`,
      ),
      q<Contagem & Record<string, unknown>>(
        `SELECT COALESCE(NULLIF(trim(m.cidade), ''), 'Não informada') AS rotulo, count(*)::int AS total
           FROM membros m WHERE ${ATIVO} AND $2::int IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`,
      ),
      q<{ id: string; nome: string; inicio_em: Date; fim_em: Date; local_nome: string | null; presentes: number }>(
        `SELECT e.id, e.nome, e.inicio_em, e.fim_em, e.local_nome,
                (SELECT count(*) FROM evento_checkins c WHERE c.evento_id = e.id)::int AS presentes
           FROM eventos e WHERE ${EV_VALIDO} ORDER BY e.inicio_em DESC LIMIT 60`,
      ),
      q<{ mes: number; presencas: number; eventos: number }>(
        `SELECT date_part('month', e.inicio_em AT TIME ZONE '${FUSO}')::int AS mes, count(c.id)::int AS presencas, count(DISTINCT e.id)::int AS eventos
           FROM eventos e LEFT JOIN evento_checkins c ON c.evento_id = e.id WHERE ${EV_VALIDO} GROUP BY 1 ORDER BY 1`,
      ),
      q<{ ym: string; total: number }>(
        `SELECT to_char(m.criado_em AT TIME ZONE '${FUSO}', 'YYYY-MM') AS ym, count(*)::int AS total
           FROM membros m WHERE m.organizacao_id = $1 AND m.excluido_em IS NULL AND m.anonimizado_em IS NULL AND m.usuario_id IS NOT NULL
            AND m.criado_em > now() - interval '12 months' AND $2::int IS NOT NULL GROUP BY 1 ORDER BY 1`,
      ),
      q<{ a: number }>(`SELECT DISTINCT ${ANO_EV}::int AS a FROM eventos e WHERE e.organizacao_id = $1 AND e.excluido_em IS NULL AND e.status <> 'rascunho' AND $2::int IS NOT NULL ORDER BY 1 DESC`),
    ]);

    let ultimas: unknown[] | null = null;
    let frequencia: { nome: string; presencas: number }[] | null = null;
    let semPresenca: number | null = null;
    if (verNomes) {
      ultimas = await q(
        `SELECT m.nome_completo AS nome, e.nome AS evento, c.registrado_em, c.metodo
           FROM evento_checkins c JOIN eventos e ON e.id = c.evento_id JOIN membros m ON m.id = c.membro_id
          WHERE e.organizacao_id = $1 AND e.excluido_em IS NULL AND e.status <> 'cancelado' AND $2::int IS NOT NULL
          ORDER BY c.registrado_em DESC LIMIT 10`,
      );
      const freq = await q<{ nome: string; presencas: number }>(
        `SELECT m.nome_completo AS nome,
                (SELECT count(*) FROM evento_checkins c JOIN eventos e ON e.id = c.evento_id WHERE c.membro_id = m.id AND ${EV_VALIDO})::int AS presencas
           FROM membros m WHERE ${ATIVO} ORDER BY presencas DESC, nome LIMIT 1000`,
      );
      frequencia = freq.slice(0, 10).filter((f) => f.presencas > 0);
      semPresenca = freq.filter((f) => f.presencas === 0).length;
    }

    const anosLista = Array.from(new Set([anoAtual, ano, ...anos.map((x) => x.a)])).sort((a, b) => b - a);
    return {
      ano,
      anos: anosLista,
      ver_nomes: verNomes,
      totais: totais[0],
      por_tlc: porTlc,
      por_comunidade: porComunidade,
      por_cidade: porCidade,
      eventos,
      por_mes: porMes,
      cadastros_por_mes: cadastros,
      ultimas_presencas: ultimas,
      mais_presentes: frequencia,
      sem_presenca: semPresenca,
    };
  }
}
