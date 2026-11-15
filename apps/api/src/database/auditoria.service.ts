import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { OrganizacaoService } from './organizacao.service';

interface Db {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

/** Grava na trilha de auditoria (a tabela só aceita inserção). */
@Injectable()
export class AuditoriaService {
  constructor(
    private readonly db: DatabaseService,
    private readonly organizacao: OrganizacaoService,
  ) {}

  async registrar(
    acao: string,
    entidade: string,
    entidadeId: string | null,
    usuarioId: string | null,
    depois: Record<string, unknown> | null,
    ip?: string,
    executor?: Db,
  ): Promise<void> {
    const org = await this.organizacao.id();
    await (executor ?? this.db).query(
      `INSERT INTO auditoria (organizacao_id, usuario_id, acao, entidade, entidade_id, depois, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [org, usuarioId, acao, entidade, entidadeId, depois ? JSON.stringify(depois) : null, ip ?? null],
    );
  }
}
