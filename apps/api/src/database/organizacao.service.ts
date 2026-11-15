import { Inject, Injectable } from '@nestjs/common';
import { ENV, Env } from '../config/env';
import { DatabaseService } from './database.service';

/** Descobre (e guarda em memória) a organização atendida; a plataforma atende um só TLC. */
@Injectable()
export class OrganizacaoService {
  private org?: Promise<string>;

  constructor(
    private readonly db: DatabaseService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  id(): Promise<string> {
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
}
