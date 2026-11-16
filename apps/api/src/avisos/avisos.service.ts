import { Injectable } from '@nestjs/common';
import { Erros } from '../common/errors';
import { AuditoriaService } from '../database/auditoria.service';
import { DatabaseService } from '../database/database.service';
import { OrganizacaoService } from '../database/organizacao.service';
import { PushService } from '../push/push.service';
import { AuthService } from '../auth/auth.service';
import type { UsuarioAutenticado } from '../auth/auth.types';
import type { AvisoInput, EditarAvisoInput } from './avisos.schemas';

const CAMPOS = `a.id, a.titulo, a.conteudo, a.fixado, a.publico_alvo, a.status, a.criado_em, a.editado_em,
                c.slug AS categoria, c.nome AS categoria_nome, c.cor AS categoria_cor,
                COALESCE(m.nome_completo, 'Coordenação') AS autor`;
const DE = `FROM avisos a
              JOIN categorias_aviso c ON c.id = a.categoria_id
              LEFT JOIN membros m ON m.usuario_id = a.autor_id`;
// Quem gerencia vê tudo (inclusive arquivados e os só da coordenação); os demais, só o publicado e aberto a membros.
const VISIVEL = `a.organizacao_id = $1 AND a.excluido_em IS NULL AND (a.expira_em IS NULL OR a.expira_em > now())
                 AND ($2::boolean OR (a.status = 'publicado' AND a.publico_alvo <> 'coordenacao'))`;

@Injectable()
export class AvisosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly organizacao: OrganizacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly auth: AuthService,
    private readonly push: PushService,
  ) {}

  private async gerencia(user: UsuarioAutenticado) {
    return (await this.auth.permissoes(user.id)).includes('avisos:publicar');
  }

  async listar(user: UsuarioAutenticado) {
    const org = await this.organizacao.id();
    const pode = await this.gerencia(user);
    const r = await this.db.query(
      `SELECT ${CAMPOS} ${DE} WHERE ${VISIVEL}
        ORDER BY (a.status = 'publicado') DESC, a.fixado DESC, a.criado_em DESC LIMIT 100`,
      [org, pode],
    );
    return { data: r.rows, pode_editar: pode };
  }

  async detalhe(user: UsuarioAutenticado, id: string) {
    const org = await this.organizacao.id();
    const pode = await this.gerencia(user);
    const r = await this.db.query(`SELECT ${CAMPOS} ${DE} WHERE ${VISIVEL} AND a.id = $3`, [org, pode, id]);
    if (!r.rows[0]) throw Erros.naoEncontrado('Aviso não encontrado');
    return { ...r.rows[0], pode_editar: pode };
  }

  async criar(user: UsuarioAutenticado, d: AvisoInput, ip?: string) {
    const org = await this.organizacao.id();
    const id = await this.db.transaction(async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO avisos (organizacao_id, titulo, conteudo, categoria_id, autor_id, status, fixado, publico_alvo)
         VALUES ($1, $2, $3, (SELECT id FROM categorias_aviso WHERE slug = $4), $5, 'publicado', $6, $7) RETURNING id`,
        [org, d.titulo, d.conteudo, d.categoria, user.id, d.fixado, d.publico_alvo],
      );
      await this.auditoria.registrar('aviso.criar', 'avisos', r.rows[0].id, user.id, { titulo: d.titulo }, ip, c);
      return r.rows[0].id;
    });
    if (d.notificar) {
      // Em segundo plano: a publicação não espera (nem falha por causa) do envio.
      void this.push.avisar({ titulo: d.titulo, texto: d.conteudo.replace(/\s+/g, ' '), url: '/portal/avisos', soCoordenacao: d.publico_alvo === 'coordenacao' });
    }
    return { id };
  }

  async editar(user: UsuarioAutenticado, id: string, d: EditarAvisoInput, ip?: string): Promise<void> {
    const org = await this.organizacao.id();
    await this.db.transaction(async (c) => {
      const r = await c.query(
        `UPDATE avisos SET titulo = $3, conteudo = $4, categoria_id = (SELECT id FROM categorias_aviso WHERE slug = $5),
                fixado = $6, publico_alvo = $7, status = $8, editado_em = now(), atualizado_em = now()
          WHERE id = $1 AND organizacao_id = $2 AND excluido_em IS NULL`,
        [id, org, d.titulo, d.conteudo, d.categoria, d.fixado, d.publico_alvo, d.status],
      );
      if (!r.rowCount) throw Erros.naoEncontrado('Aviso não encontrado');
      await this.auditoria.registrar(d.status === 'arquivado' ? 'aviso.arquivar' : 'aviso.editar', 'avisos', id, user.id, { titulo: d.titulo }, ip, c);
    });
  }
}
