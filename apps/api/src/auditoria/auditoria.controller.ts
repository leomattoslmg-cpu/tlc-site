import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Permissao, PermissaoGuard } from '../auth/permissao.guard';
import { DatabaseService } from '../database/database.service';
import { OrganizacaoService } from '../database/organizacao.service';

/** Consulta à trilha de auditoria (somente leitura; quem tem a permissão auditoria:ler). */
@Controller('auditoria')
@UseGuards(AuthGuard, PermissaoGuard)
export class AuditoriaController {
  constructor(
    private readonly db: DatabaseService,
    private readonly organizacao: OrganizacaoService,
  ) {}

  @Get()
  @Permissao('auditoria:ler')
  async listar(@Query('q') q?: string) {
    const org = await this.organizacao.id();
    const termo = typeof q === 'string' && q.trim() ? `${q.trim().slice(0, 40).replace(/[%_\\]/g, '')}%` : null;
    const r = await this.db.query(
      `SELECT a.id, a.acao, a.entidade, a.depois, host(a.ip) AS ip, a.criado_em,
              COALESCE(m.nome_completo, 'Sistema') AS quem
         FROM auditoria a
         LEFT JOIN membros m ON m.usuario_id = a.usuario_id
        WHERE a.organizacao_id = $1 AND ($2::text IS NULL OR a.acao ILIKE $2)
        ORDER BY a.criado_em DESC LIMIT 200`,
      [org, termo],
    );
    return { data: r.rows };
  }
}
