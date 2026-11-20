import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';
import { AppError, Erros } from '../common/errors';
import { DatabaseService } from '../database/database.service';
import { OrganizacaoService } from '../database/organizacao.service';
import { CryptoService, sha256 } from './crypto.service';
import { mascararCpf } from './cpf';
import { conferirSenha, erroDeSenha, hashSenha } from './senha';
import type { TokenPair, UsuarioAutenticado } from './auth.types';
import type { AtualizarDadosInput, LoginInput } from './auth.schemas';
import { AuditoriaService } from '../database/auditoria.service';

const ACESSO_SEGUNDOS = 15 * 60; // RN-AUT-07
const REFRESH_DIAS = 30; // RN-AUT-07
const MAX_FALHAS = 5; // RN-AUT-04
const BLOQUEIO_MINUTOS = 15; // RN-AUT-04

/** Qualquer coisa que execute SQL: o pool (DatabaseService) ou um cliente dentro de uma transação. */
interface Db {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

@Injectable()
export class AuthService {
  private hashFalso?: Promise<string>;

  constructor(
    private readonly db: DatabaseService,
    private readonly organizacao: OrganizacaoService,
    private readonly crypto: CryptoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private credenciaisInvalidas = () => new AppError(401, 'INVALID_CREDENTIALS', 'Credenciais inválidas');

  private async perfisDe(usuarioId: string, db: Db = this.db): Promise<string[]> {
    const r = await db.query<{ codigo: string }>(
      'SELECT p.codigo FROM usuario_perfis up JOIN perfis p ON p.id = up.perfil_id WHERE up.usuario_id = $1 ORDER BY p.nivel DESC',
      [usuarioId],
    );
    return r.rows.map((x) => x.codigo);
  }

  /** Cria a sessão: refresh token aleatório (só o hash vai para o banco) e token de acesso assinado. */
  private async criarSessao(db: Db, usuarioId: string, perfis: string[], dispositivo?: string, ip?: string): Promise<TokenPair> {
    const refresh = randomBytes(32).toString('base64url');
    const r = await db.query<{ id: string }>(
      `INSERT INTO sessoes (usuario_id, token_hash, dispositivo, ip, expira_em)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval) RETURNING id`,
      [usuarioId, sha256(refresh), dispositivo ?? null, ip ?? null, String(REFRESH_DIAS)],
    );
    return {
      access_token: this.crypto.assinar({ sub: usuarioId, sid: r.rows[0].id, per: perfis }, ACESSO_SEGUNDOS),
      refresh_token: refresh,
      expira_em: ACESSO_SEGUNDOS,
    };
  }

  async login(input: LoginInput, ip?: string) {
    const org = await this.organizacao.id();
    const r = await this.db.query<{
      id: string;
      senha_hash: string | null;
      status: string;
      bloqueado_ate: Date | null;
      nome_completo: string;
    }>(
      `SELECT u.id, u.senha_hash, u.status, u.bloqueado_ate, m.nome_completo
         FROM membros m JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.organizacao_id = $1 AND m.cpf_hash = $2 AND m.anonimizado_em IS NULL`,
      [org, this.crypto.hashCpf(input.cpf)],
    );
    const u = r.rows[0];

    if (!u) {
      // Gasta o mesmo tempo de uma conferência real, para não revelar se o CPF existe.
      this.hashFalso ??= hashSenha(randomBytes(16).toString('hex'));
      await conferirSenha(await this.hashFalso, input.senha);
      throw this.credenciaisInvalidas();
    }

    if (u.bloqueado_ate && u.bloqueado_ate.getTime() > Date.now()) {
      // Mesma resposta (e o mesmo tempo) de uma senha errada: quem testa CPFs não descobre quais existem.
      this.hashFalso ??= hashSenha(randomBytes(16).toString('hex'));
      await conferirSenha(await this.hashFalso, input.senha);
      throw this.credenciaisInvalidas();
    }

    const ok = u.senha_hash ? await conferirSenha(u.senha_hash, input.senha) : false;
    if (!ok) {
      await this.db.query(
        `UPDATE usuarios SET
           bloqueado_ate = CASE WHEN tentativas_falhas + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE bloqueado_ate END,
           tentativas_falhas = CASE WHEN tentativas_falhas + 1 >= $2 THEN 0 ELSE tentativas_falhas + 1 END
         WHERE id = $1`,
        [u.id, MAX_FALHAS, String(BLOQUEIO_MINUTOS)],
      );
      throw this.credenciaisInvalidas();
    }

    // Senha certa, mas a conta ainda não pode entrar (a mensagem não revela nada a quem não sabe a senha).
    if (u.status === 'pendente') throw new AppError(403, 'ACCOUNT_PENDING', 'Cadastro aguardando aprovação', 'A Secretaria ainda vai aprovar o seu acesso.');
    if (u.status !== 'ativo') throw new AppError(403, 'ACCOUNT_DISABLED', 'Acesso desativado', 'Procure a Secretaria do TLC.');

    const perfis = await this.perfisDe(u.id);
    const dispositivo = input.dispositivo ? `${input.dispositivo.plataforma} ${input.dispositivo.app_versao ?? ''}`.trim() : undefined;
    const tokens = await this.db.transaction(async (c) => {
      await c.query('UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL, ultimo_login_em = now() WHERE id = $1', [u.id]);
      return this.criarSessao(c, u.id, perfis, dispositivo, ip);
    });
    return { ...tokens, usuario: { id: u.id, nome: u.nome_completo, perfis } };
  }

  /** Troca o refresh token por um par novo (rotação). Reusar um token já trocado encerra todas as sessões. */
  async renovar(refreshToken: string, ip?: string): Promise<TokenPair> {
    const resultado = await this.db.transaction(async (c) => {
      const r = await c.query<{ id: string; usuario_id: string; expira_em: Date; revogado_em: Date | null; dispositivo: string | null; status: string }>(
        `SELECT s.id, s.usuario_id, s.expira_em, s.revogado_em, s.dispositivo, u.status
           FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
          WHERE s.token_hash = $1 FOR UPDATE OF s`,
        [sha256(refreshToken)],
      );
      const s = r.rows[0];
      if (!s) return { erro: true as const };
      if (s.revogado_em) {
        await c.query('UPDATE sessoes SET revogado_em = now() WHERE usuario_id = $1 AND revogado_em IS NULL', [s.usuario_id]);
        return { erro: true as const }; // confirma a revogação e só depois responde 401
      }
      if (s.expira_em.getTime() <= Date.now() || s.status !== 'ativo') return { erro: true as const };
      await c.query('UPDATE sessoes SET revogado_em = now() WHERE id = $1', [s.id]);
      const perfis = await this.perfisDe(s.usuario_id, c);
      return { erro: false as const, tokens: await this.criarSessao(c, s.usuario_id, perfis, s.dispositivo ?? undefined, ip) };
    });
    if (resultado.erro) throw Erros.naoAutenticado();
    return resultado.tokens;
  }

  async sair(sessaoId: string): Promise<void> {
    await this.db.query('UPDATE sessoes SET revogado_em = now() WHERE id = $1 AND revogado_em IS NULL', [sessaoId]);
  }

  /** O token de acesso vale 15 minutos, mas a sessão precisa continuar ativa (logout vale na hora). */
  async sessaoAtiva(sessaoId: string): Promise<boolean> {
    const r = await this.db.query('SELECT 1 FROM sessoes WHERE id = $1 AND revogado_em IS NULL AND expira_em > now()', [sessaoId]);
    return r.rows.length > 0;
  }

  async me(user: UsuarioAutenticado) {
    const r = await this.db.query(
      `SELECT u.id AS uid, u.email, u.status, u.ultimo_login_em, u.criado_em,
              m.id AS mid, m.nome_completo, m.cpf_cifrado, m.data_nascimento, m.telefone, m.whatsapp,
              m.email AS membro_email, m.cidade, m.comunidade, m.edicao_tlc, m.status AS membro_status, m.igreja_id, i.nome AS igreja_nome
         FROM usuarios u
         LEFT JOIN membros m ON m.usuario_id = u.id
         LEFT JOIN igrejas i ON i.id = m.igreja_id
        WHERE u.id = $1`,
      [user.id],
    );
    const x = r.rows[0];
    if (!x) throw Erros.naoAutenticado();
    const perfis = await this.perfisDe(user.id);
    // O titular pode ver o próprio CPF completo; os outros perfis só o mascarado.
    const cpf = x.cpf_cifrado ? this.crypto.decifrarCpf(x.cpf_cifrado as Buffer) : null;
    return {
      usuario: { id: x.uid, email: x.email, status: x.status, perfis, membro_id: x.mid ?? null, ultimo_login_em: x.ultimo_login_em, criado_em: x.criado_em },
      membro: x.mid
        ? {
            id: x.mid,
            nome_completo: x.nome_completo,
            cpf,
            cpf_mascarado: cpf ? mascararCpf(cpf) : null,
            data_nascimento: x.data_nascimento,
            telefone: x.telefone,
            whatsapp: x.whatsapp,
            email: x.membro_email,
            cidade: x.cidade,
            comunidade: x.comunidade,
            edicao_tlc: x.edicao_tlc,
            status: x.membro_status,
            igreja: { id: x.igreja_id, nome: x.igreja_nome },
          }
        : null,
    };
  }

  /** O próprio membro atualiza seus dados (o CPF não muda por aqui: é o login). */
  async atualizarDados(user: UsuarioAutenticado, d: AtualizarDadosInput, ip?: string): Promise<void> {
    try {
      await this.db.transaction(async (c) => {
        const r = await c.query<{ id: string }>(
          `UPDATE membros SET nome_completo = $2, data_nascimento = $3, email = $4, telefone = $5, whatsapp = $5,
                  cidade = $6, comunidade = $7, edicao_tlc = $8, atualizado_em = now()
            WHERE usuario_id = $1 AND excluido_em IS NULL AND anonimizado_em IS NULL RETURNING id`,
          [user.id, d.nome, d.nascimento, d.email, d.telefone, d.cidade, d.comunidade, d.edicao_tlc],
        );
        if (!r.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Cadastro não encontrado', 'Este usuário não tem ficha de membro.');
        await c.query('UPDATE usuarios SET email = $2 WHERE id = $1', [user.id, d.email]);
        await this.auditoria.registrar('membro.atualizar_dados', 'membro', r.rows[0].id, user.id, { campos: ['nome', 'nascimento', 'email', 'telefone', 'cidade', 'comunidade', 'edicao_tlc'] }, ip, c);
      });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === '23505') throw new AppError(409, 'ALREADY_EXISTS', 'E-mail já em uso', 'Este e-mail já está cadastrado em outra conta.');
      if (err.code === '23514' && err.message?.includes('13 anos')) throw new AppError(422, 'AGE_MIN', 'Idade mínima não atendida', 'O cadastro é permitido a partir de 13 anos.');
      throw e;
    }
  }

  async permissoes(usuarioId: string): Promise<string[]> {
    const r = await this.db.query<{ p: string }>(
      `SELECT DISTINCT pm.recurso || ':' || pm.acao AS p
         FROM usuario_perfis up
         JOIN perfil_permissoes pp ON pp.perfil_id = up.perfil_id
         JOIN permissoes pm ON pm.id = pp.permissao_id
        WHERE up.usuario_id = $1 ORDER BY 1`,
      [usuarioId],
    );
    return r.rows.map((x) => x.p);
  }

  /** O próprio usuário troca a senha. As outras sessões (outros aparelhos) são encerradas. */
  async trocarSenha(user: UsuarioAutenticado, atual: string, nova: string): Promise<void> {
    const r = await this.db.query<{ senha_hash: string | null }>('SELECT senha_hash FROM usuarios WHERE id = $1', [user.id]);
    const guardada = r.rows[0]?.senha_hash;
    if (!guardada || !(await conferirSenha(guardada, atual))) {
      throw new AppError(422, 'WRONG_PASSWORD', 'Senha atual incorreta', undefined, [{ campo: 'senha_atual', mensagem: 'A senha atual não confere' }]);
    }
    const erro = erroDeSenha(nova);
    if (erro) throw Erros.validacao([{ campo: 'senha_nova', mensagem: erro }]);
    const novoHash = await hashSenha(nova);
    await this.db.transaction(async (c) => {
      await c.query('UPDATE usuarios SET senha_hash = $2 WHERE id = $1', [user.id, novoHash]);
      await c.query('UPDATE sessoes SET revogado_em = now() WHERE usuario_id = $1 AND id <> $2 AND revogado_em IS NULL', [user.id, user.sid]);
    });
  }
}
