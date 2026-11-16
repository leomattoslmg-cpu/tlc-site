import { Injectable } from '@nestjs/common';
import { randomBytes, randomInt } from 'node:crypto';
import { AppError, Erros } from '../common/errors';
import { AuditoriaService } from '../database/auditoria.service';
import { DatabaseService } from '../database/database.service';
import { OrganizacaoService } from '../database/organizacao.service';
import { CryptoService } from '../auth/crypto.service';
import { mascararCpf } from '../auth/cpf';
import { hashSenha } from '../auth/senha';
import type { UsuarioAutenticado } from '../auth/auth.types';
import type { CadastroInput, CriarConviteInput } from './cadastro.schemas';

type Conv = { id: string; expira_em: Date; max_usos: number | null; usos: number; revogado_em: Date | null };

/** Cargos que o Super Administrador pode dar (o código é o do perfil no banco). */
export const CARGOS = [
  { codigo: 'coordenador_geral', nome: 'Coordenador(a) geral' },
  { codigo: 'coordenador_diocesano', nome: 'Coordenador(a) diocesano' },
  { codigo: 'tesoureiro', nome: 'Tesoureiro(a)' },
  { codigo: 'marketing', nome: 'Marketing' },
  { codigo: 'admin', nome: 'Administrador(a)' },
  { codigo: 'secretaria', nome: 'Secretaria' },
  { codigo: 'coordenador', nome: 'Coordenador(a)' },
] as const;

const conviteInvalido = () => new AppError(410, 'INVITE_INVALID', 'Convite inválido ou vencido', 'Peça um QR Code novo à coordenação.');

@Injectable()
export class CadastroService {
  constructor(
    private readonly db: DatabaseService,
    private readonly organizacao: OrganizacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly crypto: CryptoService,
  ) {}

  // ---------- convites (quem gera o QR de cadastro) ----------

  async criarConvite(user: UsuarioAutenticado, i: CriarConviteInput, ip?: string) {
    const org = await this.organizacao.id();
    const token = randomBytes(24).toString('base64url');
    const r = await this.db.query<{ id: string; expira_em: Date }>(
      `INSERT INTO convites_cadastro (organizacao_id, token, criado_por, expira_em, max_usos)
       VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval, $5) RETURNING id, expira_em`,
      [org, token, user.id, String(i.validade_horas), i.max_usos],
    );
    await this.auditoria.registrar('convite.criar', 'convites_cadastro', r.rows[0].id, user.id, { validade_horas: i.validade_horas, max_usos: i.max_usos }, ip);
    return { id: r.rows[0].id, token, expira_em: r.rows[0].expira_em };
  }

  async listarConvites() {
    const org = await this.organizacao.id();
    const r = await this.db.query(
      `SELECT id, token, expira_em, max_usos, usos, revogado_em, criado_em,
              (revogado_em IS NULL AND expira_em > now() AND (max_usos IS NULL OR usos < max_usos)) AS ativo
         FROM convites_cadastro WHERE organizacao_id = $1 ORDER BY criado_em DESC LIMIT 30`,
      [org],
    );
    return r.rows;
  }

  async revogarConvite(user: UsuarioAutenticado, id: string, ip?: string) {
    const r = await this.db.query('UPDATE convites_cadastro SET revogado_em = now() WHERE id = $1 AND revogado_em IS NULL', [id]);
    if (!r.rowCount) throw Erros.naoEncontrado('Convite não encontrado');
    await this.auditoria.registrar('convite.revogar', 'convites_cadastro', id, user.id, null, ip);
  }

  // ---------- página pública de cadastro ----------

  async conviteValido(token: string): Promise<boolean> {
    const r = await this.db.query<Conv>(
      'SELECT id, expira_em, max_usos, usos, revogado_em FROM convites_cadastro WHERE token = $1',
      [token],
    );
    const c = r.rows[0];
    return !!c && !c.revogado_em && c.expira_em.getTime() > Date.now() && (c.max_usos === null || c.usos < c.max_usos);
  }

  /** O próprio membro se cadastra. Fica "pendente" até a Secretaria aprovar. */
  async cadastrar(token: string | null, d: CadastroInput, ip?: string): Promise<void> {
    const org = await this.organizacao.id();
    const senhaHash = await hashSenha(d.senha);
    try {
      await this.db.transaction(async (c) => {
        // Com convite (QR antigo), o convite é validado e contado; sem convite, o cadastro é aberto e segue para aprovação.
        let conviteId: string | null = null;
        if (token) {
          const conv = await c.query<Conv>(
            'SELECT id, expira_em, max_usos, usos, revogado_em FROM convites_cadastro WHERE token = $1 AND organizacao_id = $2 FOR UPDATE',
            [token, org],
          );
          const cv = conv.rows[0];
          if (!cv || cv.revogado_em || cv.expira_em.getTime() <= Date.now() || (cv.max_usos !== null && cv.usos >= cv.max_usos)) throw conviteInvalido();
          conviteId = cv.id;
        }

        const hashCpf = this.crypto.hashCpf(d.cpf);
        const dup = await c.query('SELECT 1 FROM membros WHERE organizacao_id = $1 AND cpf_hash = $2', [org, hashCpf]);
        if (dup.rows.length) {
          throw new AppError(409, 'CPF_EXISTS', 'Já existe um cadastro com este CPF', 'Se for o seu, entre com o CPF e a senha. Se esqueceu a senha, fale com a Secretaria.');
        }
        const ig = await c.query<{ id: string }>('SELECT id FROM igrejas WHERE organizacao_id = $1 ORDER BY criado_em LIMIT 1', [org]);
        if (!ig.rows[0]) throw new AppError(503, 'NO_CHURCH', 'Cadastro indisponível', 'A coordenação ainda não configurou a igreja.');

        const u = await c.query<{ id: string }>(
          "INSERT INTO usuarios (organizacao_id, email, senha_hash, status) VALUES ($1, $2, $3, 'pendente') RETURNING id",
          [org, d.email, senhaHash],
        );
        const m = await c.query<{ id: string }>(
          `INSERT INTO membros (organizacao_id, usuario_id, igreja_id, nome_completo, cpf_cifrado, cpf_hash, data_nascimento,
                                telefone, whatsapp, email, status, termo_aceito_em, termo_versao, convite_id, edicao_tlc, comunidade, cidade)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, 'pendente', now(), '1', $10, $11, $12, $13) RETURNING id`,
          [org, u.rows[0].id, ig.rows[0].id, d.nome, this.crypto.cifrarCpf(d.cpf), hashCpf, d.nascimento, d.telefone, d.email, conviteId, d.edicao_tlc, d.comunidade, d.cidade],
        );
        await c.query("INSERT INTO usuario_perfis (usuario_id, perfil_id) SELECT $1, id FROM perfis WHERE codigo = 'membro'", [u.rows[0].id]);
        if (conviteId) await c.query('UPDATE convites_cadastro SET usos = usos + 1 WHERE id = $1', [conviteId]);
        await this.auditoria.registrar('membro.autocadastro', 'membros', m.rows[0].id, u.rows[0].id, { convite_id: conviteId }, ip, c);
      });
    } catch (e) {
      if (e instanceof AppError) throw e;
      const cod = (e as { code?: string }).code;
      const msg = (e as { message?: string }).message ?? '';
      if (cod === '23505') {
        throw new AppError(409, 'ALREADY_EXISTS', 'Já existe um cadastro com estes dados', 'Confira o CPF e o e-mail. Se for você, entre com o CPF e a senha.');
      }
      if (cod === '23514' && msg.includes('13 anos')) {
        throw new AppError(422, 'AGE_MIN', 'Idade mínima não atendida', 'O cadastro é permitido a partir de 13 anos.');
      }
      throw e;
    }
  }

  // ---------- aprovação (Secretaria / Administração) ----------

  async pendentes() {
    const org = await this.organizacao.id();
    const r = await this.db.query<{ id: string; nome_completo: string; cpf_cifrado: Buffer | null; email: string | null; telefone: string | null; edicao_tlc: string | null; comunidade: string | null; cidade: string | null; data_nascimento: string; criado_em: Date }>(
      `SELECT id, nome_completo, cpf_cifrado, email, telefone, edicao_tlc, comunidade, cidade, data_nascimento::text, criado_em
         FROM membros WHERE organizacao_id = $1 AND status = 'pendente' AND usuario_id IS NOT NULL AND excluido_em IS NULL
        ORDER BY criado_em`,
      [org],
    );
    return r.rows.map(({ cpf_cifrado, ...m }) => ({ ...m, cpf_mascarado: cpf_cifrado ? mascararCpf(this.crypto.decifrarCpf(cpf_cifrado)) : null }));
  }

  private async decidir(user: UsuarioAutenticado, membroId: string, aprovar: boolean, ip?: string) {
    const org = await this.organizacao.id();
    await this.db.transaction(async (c) => {
      const m = await c.query<{ usuario_id: string }>(
        "SELECT usuario_id FROM membros WHERE id = $1 AND organizacao_id = $2 AND status = 'pendente' AND usuario_id IS NOT NULL FOR UPDATE",
        [membroId, org],
      );
      if (!m.rows[0]) throw Erros.naoEncontrado('Cadastro pendente não encontrado');
      await c.query(aprovar ? "UPDATE membros SET status = 'ativo', data_ingresso = current_date WHERE id = $1" : "UPDATE membros SET status = 'inativo' WHERE id = $1", [membroId]);
      await c.query('UPDATE usuarios SET status = $2 WHERE id = $1', [m.rows[0].usuario_id, aprovar ? 'ativo' : 'inativo']);
      await this.auditoria.registrar(aprovar ? 'membro.aprovar' : 'membro.recusar', 'membros', membroId, user.id, null, ip, c);
    });
  }

  aprovar(user: UsuarioAutenticado, membroId: string, ip?: string) {
    return this.decidir(user, membroId, true, ip);
  }

  recusar(user: UsuarioAutenticado, membroId: string, ip?: string) {
    return this.decidir(user, membroId, false, ip);
  }

  // ---------- membros: busca e redefinição de senha (Secretaria) ----------

  async membros(q?: string) {
    const org = await this.organizacao.id();
    const termo = q?.trim() ? `%${q.trim().replace(/[%_\\]/g, '')}%` : null;
    const r = await this.db.query<{ id: string; nome_completo: string; cpf_cifrado: Buffer | null; telefone: string | null; email: string | null; edicao_tlc: string | null; comunidade: string | null; cidade: string | null; status: string; cargos: string[] }>(
      `SELECT m.id, m.nome_completo, m.cpf_cifrado, m.telefone, m.email, m.edicao_tlc, m.comunidade, m.cidade, m.status,
              COALESCE((SELECT array_agg(p.codigo ORDER BY p.nome) FROM usuario_perfis up JOIN perfis p ON p.id = up.perfil_id
                         WHERE up.usuario_id = m.usuario_id AND p.codigo = ANY($3::text[])), '{}') AS cargos
         FROM membros m
        WHERE m.organizacao_id = $1 AND m.anonimizado_em IS NULL AND m.excluido_em IS NULL AND m.usuario_id IS NOT NULL
          AND ($2::text IS NULL OR m.nome_completo ILIKE $2)
        ORDER BY m.nome_completo LIMIT 100`,
      [org, termo, CARGOS.map((c) => c.codigo)],
    );
    return r.rows.map(({ cpf_cifrado, ...m }) => ({ ...m, cpf_mascarado: cpf_cifrado ? mascararCpf(this.crypto.decifrarCpf(cpf_cifrado)) : null }));
  }

  private async alvoDoCargo(membroId: string, codigo: string) {
    if (!CARGOS.some((c) => c.codigo === codigo)) throw new AppError(422, 'VALIDATION_ERROR', 'Cargo inválido', 'Escolha um cargo da lista.');
    const org = await this.organizacao.id();
    const m = await this.db.query<{ usuario_id: string; status: string }>(
      `SELECT m.usuario_id, u.status FROM membros m JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.id = $1 AND m.organizacao_id = $2 AND m.excluido_em IS NULL AND m.anonimizado_em IS NULL`,
      [membroId, org],
    );
    if (!m.rows[0]) throw Erros.naoEncontrado('Membro não encontrado');
    return m.rows[0];
  }

  async darCargo(user: UsuarioAutenticado, membroId: string, codigo: string, ip?: string): Promise<void> {
    const alvo = await this.alvoDoCargo(membroId, codigo);
    if (alvo.status !== 'ativo') throw new AppError(409, 'CONFLICT', 'Cadastro ainda não aprovado', 'Aprove o cadastro antes de dar um cargo.');
    await this.db.transaction(async (c) => {
      const r = await c.query(
        `INSERT INTO usuario_perfis (usuario_id, perfil_id, atribuido_por)
         SELECT $1, id, $3 FROM perfis WHERE codigo = $2 ON CONFLICT DO NOTHING`,
        [alvo.usuario_id, codigo, user.id],
      );
      if (r.rowCount) await this.auditoria.registrar('usuario.cargo_dado', 'membros', membroId, user.id, { cargo: codigo }, ip, c);
    });
  }

  async tirarCargo(user: UsuarioAutenticado, membroId: string, codigo: string, ip?: string): Promise<void> {
    const alvo = await this.alvoDoCargo(membroId, codigo);
    await this.db.transaction(async (c) => {
      const r = await c.query('DELETE FROM usuario_perfis WHERE usuario_id = $1 AND perfil_id = (SELECT id FROM perfis WHERE codigo = $2)', [alvo.usuario_id, codigo]);
      if (r.rowCount) await this.auditoria.registrar('usuario.cargo_retirado', 'membros', membroId, user.id, { cargo: codigo }, ip, c);
    });
  }

  /** Gera uma senha temporária (mostrada uma única vez), encerra as sessões e destrava a conta. */
  async redefinirSenha(user: UsuarioAutenticado, membroId: string, ip?: string): Promise<{ senha_temporaria: string }> {
    const org = await this.organizacao.id();
    const m = await this.db.query<{ usuario_id: string }>(
      'SELECT usuario_id FROM membros WHERE id = $1 AND organizacao_id = $2 AND usuario_id IS NOT NULL AND excluido_em IS NULL',
      [membroId, org],
    );
    if (!m.rows[0]) throw Erros.naoEncontrado('Membro não encontrado');
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    const numeros = '23456789';
    const pega = (alfabeto: string, n: number) => Array.from({ length: n }, () => alfabeto[randomInt(alfabeto.length)]).join('');
    const senha = `${pega(letras, 4)}${pega(numeros, 3)}${pega(letras, 4)}`;
    const novoHash = await hashSenha(senha);
    await this.db.transaction(async (c) => {
      await c.query('UPDATE usuarios SET senha_hash = $2, tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = $1', [m.rows[0].usuario_id, novoHash]);
      await c.query('UPDATE sessoes SET revogado_em = now() WHERE usuario_id = $1 AND revogado_em IS NULL', [m.rows[0].usuario_id]);
      await this.auditoria.registrar('usuario.redefinir_senha', 'membros', membroId, user.id, null, ip, c);
    });
    return { senha_temporaria: senha };
  }
}
