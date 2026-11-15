import { Inject, Injectable } from '@nestjs/common';
import { ENV, Env } from '../config/env';
import { Erros } from '../common/errors';
import { DatabaseService } from '../database/database.service';
import type { ContatoInput } from './site.schemas';

@Injectable()
export class SiteService {
  private org?: Promise<string>;

  constructor(
    private readonly db: DatabaseService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private organizacaoId(): Promise<string> {
    this.org ??= this.db
      .query<{ id: string }>(
        this.env.ORG_SLUG
          ? 'SELECT id FROM organizacoes WHERE slug = $1'
          : 'SELECT id FROM organizacoes ORDER BY criado_em LIMIT 1',
        this.env.ORG_SLUG ? [this.env.ORG_SLUG] : [],
      )
      .then((r) => {
        if (!r.rows[0]) throw new Error('Organização não encontrada (rode as migrações e confira ORG_SLUG)');
        return r.rows[0].id;
      })
      .catch((e) => {
        this.org = undefined; // tenta de novo na próxima requisição
        throw e;
      });
    return this.org;
  }

  private url(chave: string | null): string | null {
    return chave && this.env.CDN_BASE_URL ? `${this.env.CDN_BASE_URL.replace(/\/$/, '')}/${chave}` : null;
  }

  async pagina(slug: string) {
    const org = await this.organizacaoId();
    const r = await this.db.query(
      'SELECT slug, titulo, conteudo, publicado, atualizado_em FROM paginas_site WHERE organizacao_id = $1 AND slug = $2 AND publicado',
      [org, slug],
    );
    if (!r.rows[0]) throw Erros.naoEncontrado('Página não encontrada');
    return r.rows[0];
  }

  /** Só eventos marcados como públicos; não expõe lotação nem inscritos. */
  async eventos() {
    const org = await this.organizacaoId();
    const r = await this.db.query(
      `SELECT e.id, e.nome, e.descricao, e.inicio_em, e.fim_em, e.local_nome, e.local_endereco, e.status, a.chave_storage
         FROM eventos e
         LEFT JOIN arquivos a ON a.id = e.imagem_arquivo_id AND a.confirmado_em IS NOT NULL
        WHERE e.organizacao_id = $1 AND e.publico_no_site AND e.status <> 'rascunho' AND e.excluido_em IS NULL
        ORDER BY e.inicio_em DESC
        LIMIT 100`,
      [org],
    );
    return r.rows.map(({ chave_storage, ...e }) => ({ ...e, imagem_url: this.url(chave_storage) }));
  }

  /** Só álbuns públicos e publicados (a autorização de imagem é exigida pelo próprio banco). */
  async albuns() {
    const org = await this.organizacaoId();
    const r = await this.db.query(
      `SELECT al.id, al.titulo, al.descricao, al.evento_id, al.visibilidade, al.status, al.criado_em,
              (SELECT count(*) FROM fotos f WHERE f.album_id = al.id AND f.excluido_em IS NULL)::int AS total_fotos,
              capa.chave_storage
         FROM albuns al
         LEFT JOIN LATERAL (
              SELECT arq.chave_storage
                FROM fotos f
                JOIN arquivos arq ON arq.id = COALESCE(f.miniatura_arquivo_id, f.arquivo_id) AND arq.confirmado_em IS NOT NULL
               WHERE f.album_id = al.id AND f.excluido_em IS NULL
               ORDER BY (f.id = al.capa_foto_id) DESC, f.ordem, f.criado_em
               LIMIT 1) capa ON true
        WHERE al.organizacao_id = $1 AND al.visibilidade = 'publico' AND al.status = 'publicado' AND al.excluido_em IS NULL
        ORDER BY al.criado_em DESC
        LIMIT 100`,
      [org],
    );
    return r.rows.map(({ chave_storage, ...a }) => ({ ...a, capa_url: this.url(chave_storage) }));
  }

  async registrarContato(c: ContatoInput): Promise<void> {
    const org = await this.organizacaoId();
    await this.db.query(
      'INSERT INTO mensagens_contato (organizacao_id, nome, email, telefone, assunto, mensagem) VALUES ($1, $2, $3, $4, $5, $6)',
      [org, c.nome, c.email, c.telefone ?? null, c.assunto, c.mensagem],
    );
  }
}
