import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppError, Erros } from '../common/errors';
import { PushService } from '../push/push.service';
import { AuditoriaService } from '../database/auditoria.service';
import { DatabaseService } from '../database/database.service';
import { OrganizacaoService } from '../database/organizacao.service';
import type { UsuarioAutenticado } from '../auth/auth.types';
import type { CriarEventoInput } from './eventos.schemas';

const ANTES_MS = 2 * 60 * 60 * 1000; // a presença abre 2 h antes do início
const DEPOIS_MS = 3 * 60 * 60 * 1000; // e fecha 3 h depois do fim

type EventoQr = {
  id: string;
  nome: string;
  inicio_em: Date;
  fim_em: Date;
  status: string;
  local_nome: string | null;
};

@Injectable()
export class EventosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly organizacao: OrganizacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly push: PushService,
  ) {}

  async criar(user: UsuarioAutenticado, i: CriarEventoInput, ip?: string) {
    const org = await this.organizacao.id();
    const token = randomBytes(24).toString('base64url');
    const r = await this.db.query<{ id: string }>(
      `INSERT INTO eventos (organizacao_id, nome, descricao, inicio_em, fim_em, local_nome, status, publico_no_site,
                            exige_inscricao, checkin_token, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, 'inscricoes_abertas', $7, false, $8, $9) RETURNING id`,
      [org, i.nome, i.descricao ?? null, i.inicio_em, i.fim_em, i.local_nome ?? null, i.publico_no_site, token, user.id],
    );
    await this.auditoria.registrar('evento.criar', 'eventos', r.rows[0].id, user.id, { nome: i.nome, inicio_em: i.inicio_em }, ip);
    // Na hora: todo mundo que ativou as notificações recebe o evento novo.
    const quando = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande' }).format(new Date(i.inicio_em));
    void this.push.avisar({ titulo: `Novo evento: ${i.nome}`, texto: `${quando}${i.local_nome ? ` · ${i.local_nome}` : ''}`, url: '/portal', soCoordenacao: false });
    return { id: r.rows[0].id, checkin_token: token };
  }

  async listar() {
    const org = await this.organizacao.id();
    const r = await this.db.query(
      `SELECT e.id, e.nome, e.descricao, e.inicio_em, e.fim_em, e.local_nome, e.status, e.publico_no_site, e.checkin_token,
              (SELECT count(*) FROM evento_checkins c WHERE c.evento_id = e.id)::int AS presentes
         FROM eventos e
        WHERE e.organizacao_id = $1 AND e.excluido_em IS NULL
        ORDER BY e.inicio_em DESC LIMIT 200`,
      [org],
    );
    return r.rows;
  }

  async detalhe(id: string) {
    const org = await this.organizacao.id();
    const e = await this.db.query(
      `SELECT id, nome, descricao, inicio_em, fim_em, local_nome, status, publico_no_site, checkin_token
         FROM eventos WHERE id = $1 AND organizacao_id = $2 AND excluido_em IS NULL`,
      [id, org],
    );
    if (!e.rows[0]) throw Erros.naoEncontrado('Evento não encontrado');
    const p = await this.db.query(
      `SELECT m.id AS membro_id, m.nome_completo, c.metodo, c.registrado_em, c.ip
         FROM evento_checkins c JOIN membros m ON m.id = c.membro_id
        WHERE c.evento_id = $1 ORDER BY c.registrado_em`,
      [id],
    );
    return { evento: e.rows[0], presencas: p.rows };
  }

  async cancelar(user: UsuarioAutenticado, id: string, ip?: string) {
    const org = await this.organizacao.id();
    const r = await this.db.query<{ nome: string }>(
      "UPDATE eventos SET status = 'cancelado' WHERE id = $1 AND organizacao_id = $2 AND excluido_em IS NULL AND status <> 'cancelado' RETURNING nome",
      [id, org],
    );
    if (!r.rowCount) throw Erros.naoEncontrado('Evento não encontrado ou já cancelado');
    await this.auditoria.registrar('evento.cancelar', 'eventos', id, user.id, null, ip);
    void this.push.avisar({ titulo: `Evento cancelado: ${r.rows[0].nome}`, texto: 'Fique de olho nos avisos para saber os próximos passos.', url: '/portal', soCoordenacao: false });
  }

  /** Troca o código do QR. O cartaz antigo deixa de funcionar na hora. */
  async novoQr(user: UsuarioAutenticado, id: string, ip?: string): Promise<{ checkin_token: string }> {
    const org = await this.organizacao.id();
    const token = randomBytes(24).toString('base64url');
    const r = await this.db.query('UPDATE eventos SET checkin_token = $3 WHERE id = $1 AND organizacao_id = $2 AND excluido_em IS NULL', [id, org, token]);
    if (!r.rowCount) throw Erros.naoEncontrado('Evento não encontrado');
    await this.auditoria.registrar('evento.trocar_qr', 'eventos', id, user.id, null, ip);
    return { checkin_token: token };
  }

  private async eventoPorToken(token: string): Promise<EventoQr> {
    const org = await this.organizacao.id();
    const r = await this.db.query<EventoQr>(
      'SELECT id, nome, inicio_em, fim_em, status, local_nome FROM eventos WHERE checkin_token = $1 AND organizacao_id = $2 AND excluido_em IS NULL',
      [token, org],
    );
    if (!r.rows[0]) throw new AppError(404, 'QR_INVALID', 'QR Code inválido', 'Este QR Code não é de nenhum evento. Peça outro à coordenação.');
    return r.rows[0];
  }

  private janela(e: EventoQr): 'ok' | 'cedo' | 'tarde' | 'cancelado' {
    if (e.status === 'cancelado') return 'cancelado';
    const agora = Date.now();
    if (agora < e.inicio_em.getTime() - ANTES_MS) return 'cedo';
    if (agora > e.fim_em.getTime() + DEPOIS_MS) return 'tarde';
    return 'ok';
  }

  private async membroDe(usuarioId: string): Promise<string> {
    const m = await this.db.query<{ id: string; status: string }>(
      'SELECT id, status FROM membros WHERE usuario_id = $1 AND anonimizado_em IS NULL AND excluido_em IS NULL',
      [usuarioId],
    );
    if (!m.rows[0] || m.rows[0].status !== 'ativo') throw Erros.semPermissao();
    return m.rows[0].id;
  }

  /** Mostra o evento do QR e se a pessoa já marcou presença (a marcação só acontece no POST). */
  async infoPresenca(token: string, user: UsuarioAutenticado) {
    const e = await this.eventoPorToken(token);
    const membro = await this.membroDe(user.id);
    const ja = await this.db.query<{ registrado_em: Date }>('SELECT registrado_em FROM evento_checkins WHERE evento_id = $1 AND membro_id = $2', [e.id, membro]);
    return {
      evento: { nome: e.nome, inicio_em: e.inicio_em, fim_em: e.fim_em, local_nome: e.local_nome },
      janela: this.janela(e),
      ja_registrada: ja.rows.length > 0,
      registrado_em: ja.rows[0]?.registrado_em ?? null,
    };
  }

  /** Marca a presença de quem está logado. Cada pessoa só conta uma vez por evento (a regra também vale no banco). */
  async registrarPresenca(token: string, user: UsuarioAutenticado, ip?: string, dispositivo?: string) {
    const e = await this.eventoPorToken(token);
    const membro = await this.membroDe(user.id);
    const j = this.janela(e);
    if (j === 'cancelado') throw new AppError(409, 'EVENT_CANCELLED', 'Evento cancelado');
    if (j === 'cedo') throw new AppError(409, 'CHECKIN_NOT_OPEN', 'A presença ainda não abriu', 'Ela abre 2 horas antes do início do evento.');
    if (j === 'tarde') throw new AppError(409, 'CHECKIN_CLOSED', 'A presença já foi encerrada');

    const novo = await this.db.transaction(async (c) => {
      const r = await c.query<{ registrado_em: Date }>(
        `INSERT INTO evento_checkins (evento_id, membro_id, metodo, registrado_por, ip, dispositivo)
         VALUES ($1, $2, 'qr', $3, $4, $5)
         ON CONFLICT (evento_id, membro_id) DO NOTHING RETURNING registrado_em`,
        [e.id, membro, user.id, ip ?? null, dispositivo?.slice(0, 300) ?? null],
      );
      if (r.rows[0]) {
        await this.auditoria.registrar('evento.presenca', 'eventos', e.id, user.id, { membro_id: membro, metodo: 'qr' }, ip, c);
      }
      return r.rows[0] ?? null;
    });
    if (novo) return { ja_registrada: false, registrado_em: novo.registrado_em, evento: { nome: e.nome } };
    const antes = await this.db.query<{ registrado_em: Date }>('SELECT registrado_em FROM evento_checkins WHERE evento_id = $1 AND membro_id = $2', [e.id, membro]);
    return { ja_registrada: true, registrado_em: antes.rows[0]?.registrado_em ?? null, evento: { nome: e.nome } };
  }
}
