import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { OrganizacaoService } from '../database/organizacao.service';

const FUSO = 'America/Campo_Grande';
const ANO_EV = `date_part('year', e.inicio_em AT TIME ZONE '${FUSO}')`;
const ATIVO = `m.organizacao_id = $1 AND m.status = 'ativo' AND m.excluido_em IS NULL AND m.anonimizado_em IS NULL AND m.usuario_id IS NOT NULL`;
const EV_VALIDO = `e.organizacao_id = $1 AND e.excluido_em IS NULL AND e.status NOT IN ('rascunho', 'cancelado') AND ${ANO_EV} = $2`;

/** Filtros por participante (rótulos exatamente como aparecem nos gráficos). */
const FM = `($3::text IS NULL OR COALESCE(NULLIF(trim(m.edicao_tlc), ''), 'Não informado') = $3)
  AND ($4::text IS NULL OR COALESCE(NULLIF(trim(m.comunidade), ''), 'Não informada') = $4)
  AND ($5::text IS NULL OR COALESCE(NULLIF(trim(m.cidade), ''), 'Não informada') = $5)`;
/** Faz o Postgres aceitar parâmetros que uma consulta específica não usa. */
const TODOS = `(true OR $2::int IS NULL OR $3::text IS NULL OR $4::text IS NULL OR $5::text IS NULL OR $6::text IS NULL)`;

export interface Filtros { tlc?: string; comunidade?: string; cidade?: string }
export const TIPOS_DETALHE = ['participantes', 'pendentes', 'sem_presenca', 'cadastro_mes', 'eventos', 'realizados', 'proximos', 'presencas', 'presencas_hoje', 'mes', 'evento'] as const;
export type TipoDetalhe = (typeof TIPOS_DETALHE)[number];

interface Contagem { rotulo: string; total: number }

@Injectable()
export class PainelService {
  constructor(
    private readonly db: DatabaseService,
    private readonly organizacao: OrganizacaoService,
    private readonly auth: AuthService,
  ) {}

  async resumo(user: UsuarioAutenticado, anoPedido?: number, f: Filtros = {}) {
    const org = await this.organizacao.id();
    const anoAtual = Number((await this.db.query<{ a: number }>(`SELECT date_part('year', now() AT TIME ZONE '${FUSO}')::int AS a`)).rows[0].a);
    const ano = anoPedido ?? anoAtual;
    // Nomes de pessoas só para quem pode ver a lista de membros (Marketing e Tesouraria veem apenas os números).
    const verNomes = (await this.auth.permissoes(user.id)).includes('membros:ler');
    const q = <T extends Record<string, unknown>>(sql: string, p: unknown[] = [org, ano]) => this.db.query<T>(sql, p).then((r) => r.rows);
    const pf = [org, ano, f.tlc ?? null, f.comunidade ?? null, f.cidade ?? null];
    const qf = <T extends Record<string, unknown>>(sql: string) => q<T>(sql, pf);

    const [pessoas, contEv, pres, porTlc, porComunidade, porCidade, eventos, porMes, cadastros, anos, opTlc, opCom, opCid] = await Promise.all([
      qf<{ participantes: number; pendentes: number }>(
        `SELECT
           (SELECT count(*) FROM membros m WHERE ${ATIVO} AND ${FM} AND $2::int IS NOT NULL)::int AS participantes,
           (SELECT count(*) FROM membros m WHERE m.organizacao_id = $1 AND m.status = 'pendente' AND m.excluido_em IS NULL AND m.anonimizado_em IS NULL AND m.usuario_id IS NOT NULL AND ${FM})::int AS pendentes`,
      ),
      q<{ eventos: number; realizados: number; proximos: number }>(
        `SELECT
           (SELECT count(*) FROM eventos e WHERE ${EV_VALIDO})::int AS eventos,
           (SELECT count(*) FROM eventos e WHERE ${EV_VALIDO} AND e.fim_em < now())::int AS realizados,
           (SELECT count(*) FROM eventos e WHERE ${EV_VALIDO} AND e.fim_em >= now())::int AS proximos`,
      ),
      qf<{ presencas: number; presencas_hoje: number }>(
        `SELECT
           (SELECT count(*) FROM evento_checkins c JOIN eventos e ON e.id = c.evento_id JOIN membros m ON m.id = c.membro_id WHERE ${EV_VALIDO} AND ${FM})::int AS presencas,
           (SELECT count(*) FROM evento_checkins c JOIN eventos e ON e.id = c.evento_id JOIN membros m ON m.id = c.membro_id
             WHERE e.organizacao_id = $1 AND e.excluido_em IS NULL AND e.status <> 'cancelado' AND ${FM} AND $2::int IS NOT NULL
               AND (c.registrado_em AT TIME ZONE '${FUSO}')::date = (now() AT TIME ZONE '${FUSO}')::date)::int AS presencas_hoje`,
      ),
      qf<Contagem & Record<string, unknown>>(
        `SELECT COALESCE(NULLIF(trim(m.edicao_tlc), ''), 'Não informado') AS rotulo, count(*)::int AS total
           FROM membros m WHERE ${ATIVO} AND ${FM} AND $2::int IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 40`,
      ),
      qf<Contagem & Record<string, unknown>>(
        `SELECT COALESCE(NULLIF(trim(m.comunidade), ''), 'Não informada') AS rotulo, count(*)::int AS total
           FROM membros m WHERE ${ATIVO} AND ${FM} AND $2::int IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`,
      ),
      qf<Contagem & Record<string, unknown>>(
        `SELECT COALESCE(NULLIF(trim(m.cidade), ''), 'Não informada') AS rotulo, count(*)::int AS total
           FROM membros m WHERE ${ATIVO} AND ${FM} AND $2::int IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`,
      ),
      qf<{ id: string; nome: string; inicio_em: Date; fim_em: Date; local_nome: string | null; presentes: number }>(
        `SELECT e.id, e.nome, e.inicio_em, e.fim_em, e.local_nome,
                (SELECT count(*) FROM evento_checkins c JOIN membros m ON m.id = c.membro_id WHERE c.evento_id = e.id AND ${FM})::int AS presentes
           FROM eventos e WHERE ${EV_VALIDO} ORDER BY e.inicio_em DESC LIMIT 60`,
      ),
      qf<{ mes: number; presencas: number; eventos: number }>(
        `SELECT date_part('month', e.inicio_em AT TIME ZONE '${FUSO}')::int AS mes, count(m.id)::int AS presencas, count(DISTINCT e.id)::int AS eventos
           FROM eventos e LEFT JOIN evento_checkins c ON c.evento_id = e.id LEFT JOIN membros m ON m.id = c.membro_id AND ${FM}
          WHERE ${EV_VALIDO} GROUP BY 1 ORDER BY 1`,
      ),
      qf<{ ym: string; total: number }>(
        `SELECT to_char(m.criado_em AT TIME ZONE '${FUSO}', 'YYYY-MM') AS ym, count(*)::int AS total
           FROM membros m WHERE m.organizacao_id = $1 AND m.excluido_em IS NULL AND m.anonimizado_em IS NULL AND m.usuario_id IS NOT NULL
            AND m.criado_em > now() - interval '12 months' AND ${FM} AND $2::int IS NOT NULL GROUP BY 1 ORDER BY 1`,
      ),
      q<{ a: number }>(`SELECT DISTINCT ${ANO_EV}::int AS a FROM eventos e WHERE e.organizacao_id = $1 AND e.excluido_em IS NULL AND e.status <> 'rascunho' AND $2::int IS NOT NULL ORDER BY 1 DESC`),
      q<{ r: string }>(`SELECT DISTINCT COALESCE(NULLIF(trim(m.edicao_tlc), ''), 'Não informado') AS r FROM membros m WHERE ${ATIVO} ORDER BY 1 LIMIT 100`, [org]),
      q<{ r: string }>(`SELECT DISTINCT COALESCE(NULLIF(trim(m.comunidade), ''), 'Não informada') AS r FROM membros m WHERE ${ATIVO} ORDER BY 1 LIMIT 200`, [org]),
      q<{ r: string }>(`SELECT DISTINCT COALESCE(NULLIF(trim(m.cidade), ''), 'Não informada') AS r FROM membros m WHERE ${ATIVO} ORDER BY 1 LIMIT 200`, [org]),
    ]);
    const totais = { ...pessoas[0], ...contEv[0], ...pres[0] };

    let ultimas: unknown[] | null = null;
    let frequencia: { nome: string; presencas: number }[] | null = null;
    let semPresenca: number | null = null;
    if (verNomes) {
      ultimas = await qf(
        `SELECT m.nome_completo AS nome, e.nome AS evento, c.registrado_em, c.metodo
           FROM evento_checkins c JOIN eventos e ON e.id = c.evento_id JOIN membros m ON m.id = c.membro_id
          WHERE e.organizacao_id = $1 AND e.excluido_em IS NULL AND e.status <> 'cancelado' AND ${FM} AND $2::int IS NOT NULL
          ORDER BY c.registrado_em DESC LIMIT 10`,
      );
      const freq = await qf<{ nome: string; presencas: number }>(
        `SELECT m.nome_completo AS nome,
                (SELECT count(*) FROM evento_checkins c JOIN eventos e ON e.id = c.evento_id WHERE c.membro_id = m.id AND ${EV_VALIDO})::int AS presencas
           FROM membros m WHERE ${ATIVO} AND ${FM} ORDER BY presencas DESC, nome LIMIT 1000`,
      );
      frequencia = freq.slice(0, 10).filter((x) => x.presencas > 0);
      semPresenca = freq.filter((x) => x.presencas === 0).length;
    }

    const anosLista = Array.from(new Set([anoAtual, ano, ...anos.map((x) => x.a)])).sort((a, b) => b - a);
    return {
      ano,
      anos: anosLista,
      ver_nomes: verNomes,
      filtros: { tlc: f.tlc ?? null, comunidade: f.comunidade ?? null, cidade: f.cidade ?? null },
      opcoes: { tlc: opTlc.map((x) => x.r), comunidade: opCom.map((x) => x.r), cidade: opCid.map((x) => x.r) },
      totais,
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

  /** Abre os dados por trás de um número ou barra do painel (pessoas, eventos ou presenças). */
  async detalhe(user: UsuarioAutenticado, tipo: TipoDetalhe, anoPedido: number | undefined, f: Filtros, valor?: string) {
    const org = await this.organizacao.id();
    const anoAtual = Number((await this.db.query<{ a: number }>(`SELECT date_part('year', now() AT TIME ZONE '${FUSO}')::int AS a`)).rows[0].a);
    const ano = anoPedido ?? anoAtual;
    const verNomes = (await this.auth.permissoes(user.id)).includes('membros:ler');
    const params = [org, ano, f.tlc ?? null, f.comunidade ?? null, f.cidade ?? null, valor ?? null];
    const rows = (sql: string) => this.db.query<Record<string, unknown>>(sql, params).then((r) => r.rows);
    const LIM = 501;
    const fechar = (titulo: string, forma: 'pessoas' | 'eventos' | 'presencas', linhas: Record<string, unknown>[]) => ({
      titulo, forma, limitado: linhas.length >= LIM, linhas: linhas.slice(0, LIM - 1),
    });
    const COLS = `m.id, m.nome_completo AS nome,
      COALESCE(NULLIF(trim(m.edicao_tlc), ''), 'Não informado') AS tlc,
      COALESCE(NULLIF(trim(m.comunidade), ''), 'Não informada') AS comunidade,
      COALESCE(NULLIF(trim(m.cidade), ''), 'Não informada') AS cidade, m.criado_em,
      (SELECT count(*) FROM evento_checkins c JOIN eventos e ON e.id = c.evento_id WHERE c.membro_id = m.id AND ${EV_VALIDO})::int AS presencas`;
    const PRES_BASE = `FROM evento_checkins c JOIN eventos e ON e.id = c.evento_id JOIN membros m ON m.id = c.membro_id
      WHERE e.organizacao_id = $1 AND e.excluido_em IS NULL AND e.status <> 'cancelado' AND ${FM} AND ${TODOS}`;
    const PRES_COLS = `SELECT m.id AS membro_id, m.nome_completo AS nome, e.id AS evento_id, e.nome AS evento, c.registrado_em, c.metodo`;
    const EVS = (extra: string) => `SELECT e.id, e.nome, e.inicio_em, e.fim_em, e.local_nome,
        (SELECT count(*) FROM evento_checkins c JOIN membros m ON m.id = c.membro_id WHERE c.evento_id = e.id AND ${FM})::int AS presentes
      FROM eventos e WHERE ${EV_VALIDO} ${extra} AND ${TODOS} ORDER BY e.inicio_em DESC LIMIT ${LIM}`;
    const PESSOAS = (cond: string) => `SELECT ${COLS} FROM membros m WHERE ${cond} AND ${FM} AND ${TODOS} ORDER BY m.nome_completo LIMIT ${LIM}`;
    const PENDENTE = `m.organizacao_id = $1 AND m.status = 'pendente' AND m.excluido_em IS NULL AND m.anonimizado_em IS NULL AND m.usuario_id IS NOT NULL`;

    switch (tipo) {
      case 'eventos': return fechar(`Eventos de ${ano}`, 'eventos', await rows(EVS('')));
      case 'realizados': return fechar(`Eventos realizados em ${ano}`, 'eventos', await rows(EVS('AND e.fim_em < now()')));
      case 'proximos': return fechar(`Eventos a caminho em ${ano}`, 'eventos', await rows(EVS('AND e.fim_em >= now()')));
    }
    if (!verNomes) return null; // as demais telas mostram nomes de pessoas
    switch (tipo) {
      case 'participantes': return fechar('Participantes', 'pessoas', await rows(PESSOAS(ATIVO)));
      case 'pendentes': return fechar('Cadastros aguardando aprovação', 'pessoas', await rows(PESSOAS(PENDENTE)));
      case 'sem_presenca':
        return fechar(`Sem nenhuma presença em ${ano}`, 'pessoas', await rows(PESSOAS(
          `${ATIVO} AND NOT EXISTS (SELECT 1 FROM evento_checkins c JOIN eventos e ON e.id = c.evento_id WHERE c.membro_id = m.id AND ${EV_VALIDO})`)));
      case 'cadastro_mes':
        return fechar(`Cadastros de ${valor ?? ''}`, 'pessoas', await rows(PESSOAS(
          `m.organizacao_id = $1 AND m.excluido_em IS NULL AND m.anonimizado_em IS NULL AND m.usuario_id IS NOT NULL AND to_char(m.criado_em AT TIME ZONE '${FUSO}', 'YYYY-MM') = $6::text`)));
      case 'presencas':
        return fechar(`Presenças em ${ano}`, 'presencas', await rows(`${PRES_COLS} ${PRES_BASE} AND ${ANO_EV} = $2 ORDER BY c.registrado_em DESC LIMIT ${LIM}`));
      case 'presencas_hoje':
        return fechar('Presenças de hoje', 'presencas', await rows(`${PRES_COLS} ${PRES_BASE}
          AND (c.registrado_em AT TIME ZONE '${FUSO}')::date = (now() AT TIME ZONE '${FUSO}')::date ORDER BY c.registrado_em DESC LIMIT ${LIM}`));
      case 'mes':
        return fechar(`Presenças em ${valor ?? ''}/${ano}`, 'presencas', await rows(`${PRES_COLS} ${PRES_BASE}
          AND ${ANO_EV} = $2 AND date_part('month', e.inicio_em AT TIME ZONE '${FUSO}')::int = $6::int ORDER BY c.registrado_em DESC LIMIT ${LIM}`));
      case 'evento':
        return fechar('Presentes no evento', 'presencas', await rows(`${PRES_COLS} ${PRES_BASE} AND e.id = $6::uuid ORDER BY m.nome_completo LIMIT ${LIM}`));
      default: return null;
    }
  }
}
