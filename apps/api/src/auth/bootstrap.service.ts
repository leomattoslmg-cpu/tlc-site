import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { z } from 'zod';
import { ENV, Env } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { OrganizacaoService } from '../database/organizacao.service';
import { cpfSchema } from './auth.schemas';
import { CryptoService } from './crypto.service';
import { erroDeSenha, hashSenha } from './senha';

const schema = z.object({
  cpf: cpfSchema,
  nome: z.string().trim().min(3),
  nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD'),
  email: z.string().trim().toLowerCase().email(),
  telefone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use o formato +5567999990001'),
  senha: z.string().refine((s) => erroDeSenha(s) === null, 'Senha fraca (mín. 8 caracteres, com letra e número)'),
});

/**
 * Cria o primeiro Super Administrador a partir de variáveis de ambiente (BOOTSTRAP_ADMIN_*).
 * Só age se ainda não existir nenhum Super Administrador; depois de criado, apague a variável da senha.
 * Existe porque a hospedagem gratuita não dá acesso a terminal.
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly log = new Logger('Bootstrap');

  constructor(
    private readonly db: DatabaseService,
    private readonly organizacao: OrganizacaoService,
    private readonly crypto: CryptoService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const e = this.env;
    if (!e.BOOTSTRAP_ADMIN_CPF && !e.BOOTSTRAP_ADMIN_SENHA) return;
    try {
      await this.criar();
    } catch (err) {
      // Nunca derruba a API; mostra o motivo no log.
      this.log.error(`Não foi possível criar o primeiro administrador: ${(err as Error).message}`);
    }
  }

  private async criar(): Promise<void> {
    const e = this.env;
    const dados = schema.safeParse({
      cpf: e.BOOTSTRAP_ADMIN_CPF,
      nome: e.BOOTSTRAP_ADMIN_NOME,
      nascimento: e.BOOTSTRAP_ADMIN_NASCIMENTO,
      email: e.BOOTSTRAP_ADMIN_EMAIL,
      telefone: e.BOOTSTRAP_ADMIN_TELEFONE,
      senha: e.BOOTSTRAP_ADMIN_SENHA,
    });
    if (!dados.success) {
      const motivo = dados.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`variáveis BOOTSTRAP_ADMIN_* inválidas ou incompletas (${motivo})`);
    }
    const d = dados.data;

    const ja = await this.db.query("SELECT 1 FROM usuario_perfis up JOIN perfis p ON p.id = up.perfil_id WHERE p.codigo = 'super_admin' LIMIT 1");
    if (ja.rows.length) {
      this.log.log('Já existe um Super Administrador; nada a fazer (pode apagar as variáveis BOOTSTRAP_ADMIN_*).');
      return;
    }

    const org = await this.organizacao.id();
    const senhaHash = await hashSenha(d.senha);
    await this.db.transaction(async (c) => {
      const ig = await c.query<{ id: string }>(
        `INSERT INTO igrejas (organizacao_id, nome) VALUES ($1, 'Sede')
         ON CONFLICT (organizacao_id, nome) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`,
        [org],
      );
      const u = await c.query<{ id: string }>(
        `INSERT INTO usuarios (organizacao_id, email, senha_hash, status, email_verificado_em)
         VALUES ($1, $2, $3, 'ativo', now()) RETURNING id`,
        [org, d.email, senhaHash],
      );
      await c.query(
        `INSERT INTO membros (organizacao_id, usuario_id, igreja_id, nome_completo, cpf_cifrado, cpf_hash, data_nascimento,
                              telefone, email, status, data_ingresso, termo_aceito_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ativo', current_date, now())`,
        [org, u.rows[0].id, ig.rows[0].id, d.nome, this.crypto.cifrarCpf(d.cpf), this.crypto.hashCpf(d.cpf), d.nascimento, d.telefone, d.email],
      );
      await c.query(
        "INSERT INTO usuario_perfis (usuario_id, perfil_id) SELECT $1, id FROM perfis WHERE codigo IN ('super_admin', 'membro')",
        [u.rows[0].id],
      );
    });
    this.log.log('Primeiro Super Administrador criado. Apague agora a variável BOOTSTRAP_ADMIN_SENHA.');
  }
}
