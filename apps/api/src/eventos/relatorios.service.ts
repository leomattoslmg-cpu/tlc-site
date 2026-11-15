import { Injectable } from '@nestjs/common';
import { AuditoriaService } from '../database/auditoria.service';
import { DatabaseService } from '../database/database.service';
import { OrganizacaoService } from '../database/organizacao.service';
import type { UsuarioAutenticado } from '../auth/auth.types';

const FUSO = 'America/Campo_Grande';
const ANO_EV = `date_part('year', e.inicio_em AT TIME ZONE '${FUSO}')`;

/** Uma célula de CSV: aspas quando preciso e proteção contra fórmulas (=, +, -, @) ao abrir no Excel. */
function celula(v: unknown): string {
  let t = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@]/.test(t)) t = `'${t}`;
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** CSV com ";" e BOM, o formato que o Excel em português abre direto (e o Google Planilhas também lê). */
function csv(cabecalho: string[], linhas: unknown[][]): string {
  return '﻿' + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
}

const fmtData = (d: unknown) => (d instanceof Date ? new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' }).format(d) : '');
const fmtDia = (d: unknown) => (d instanceof Date ? new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short' }).format(d) : '');

@Injectable()
export class RelatoriosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly organizacao: OrganizacaoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async registrar(user: UsuarioAutenticado, relatorio: string, ano: number, ip?: string) {
    await this.auditoria.registrar('relatorio.exportar', 'relatorios', null, user.id, { relatorio, ano }, ip);
  }

  /** Eventos do ano e quantas pessoas marcaram presença em cada um. */
  async eventos(user: UsuarioAutenticado, ano: number, ip?: string): Promise<string> {
    const org = await this.organizacao.id();
    const r = await this.db.query<{ nome: string; inicio_em: Date; fim_em: Date; local_nome: string | null; status: string; presentes: number }>(
      `SELECT e.nome, e.inicio_em, e.fim_em, e.local_nome, e.status,
              (SELECT count(*) FROM evento_checkins c WHERE c.evento_id = e.id)::int AS presentes
         FROM eventos e
        WHERE e.organizacao_id = $1 AND e.excluido_em IS NULL AND e.status <> 'rascunho' AND ${ANO_EV} = $2
        ORDER BY e.inicio_em`,
      [org, ano],
    );
    await this.registrar(user, 'eventos', ano, ip);
    return csv(
      ['Evento', 'Data de início', 'Data de fim', 'Local', 'Situação', 'Presentes'],
      r.rows.map((x) => [x.nome, fmtData(x.inicio_em), fmtData(x.fim_em), x.local_nome, x.status === 'cancelado' ? 'Cancelado' : 'Realizado/previsto', x.presentes]),
    );
  }

  /** Cada presença registrada, com data, hora, forma e IP (trilha de auditoria). */
  async presencas(user: UsuarioAutenticado, ano: number, ip?: string): Promise<string> {
    const org = await this.organizacao.id();
    const r = await this.db.query<{ evento: string; inicio_em: Date; membro: string; metodo: string; registrado_em: Date; ip: string | null; registrado_por: string | null }>(
      `SELECT e.nome AS evento, e.inicio_em, m.nome_completo AS membro, c.metodo, c.registrado_em, host(c.ip) AS ip,
              rm.nome_completo AS registrado_por
         FROM evento_checkins c
         JOIN eventos e ON e.id = c.evento_id
         JOIN membros m ON m.id = c.membro_id
         LEFT JOIN membros rm ON rm.usuario_id = c.registrado_por
        WHERE e.organizacao_id = $1 AND e.excluido_em IS NULL AND ${ANO_EV} = $2
        ORDER BY e.inicio_em, m.nome_completo`,
      [org, ano],
    );
    await this.registrar(user, 'presencas', ano, ip);
    return csv(
      ['Evento', 'Data do evento', 'Membro', 'Forma', 'Registrada em', 'Registrada por', 'IP'],
      r.rows.map((x) => [x.evento, fmtDia(x.inicio_em), x.membro, x.metodo === 'qr' ? 'QR Code' : 'Manual', fmtData(x.registrado_em), x.registrado_por, x.ip]),
    );
  }

  /** Quantas vezes cada membro ativo participou no ano, sobre o total de eventos já realizados. */
  async frequencia(user: UsuarioAutenticado, ano: number, ip?: string): Promise<string> {
    const org = await this.organizacao.id();
    const r = await this.db.query<{ nome: string; presencas: number; total: number }>(
      `WITH ev AS (
         SELECT e.id FROM eventos e
          WHERE e.organizacao_id = $1 AND e.excluido_em IS NULL AND e.status NOT IN ('rascunho', 'cancelado')
            AND ${ANO_EV} = $2 AND e.inicio_em <= now())
       SELECT m.nome_completo AS nome,
              (SELECT count(*) FROM evento_checkins c WHERE c.membro_id = m.id AND c.evento_id IN (SELECT id FROM ev))::int AS presencas,
              (SELECT count(*) FROM ev)::int AS total
         FROM membros m
        WHERE m.organizacao_id = $1 AND m.status = 'ativo' AND m.anonimizado_em IS NULL AND m.excluido_em IS NULL
        ORDER BY presencas DESC, m.nome_completo`,
      [org, ano],
    );
    await this.registrar(user, 'frequencia', ano, ip);
    return csv(
      ['Membro', 'Presenças', 'Eventos realizados', 'Frequência'],
      r.rows.map((x) => [x.nome, x.presencas, x.total, x.total ? `${Math.round((x.presencas / x.total) * 100)}%` : '']),
    );
  }
}
