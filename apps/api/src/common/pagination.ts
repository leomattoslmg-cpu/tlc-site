import { z } from 'zod';
import { Erros } from './errors';

/** Lista paginada do painel: ?page=1&per_page=20&q=...&sort=-criado_em */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.string().regex(/^-?[a-z_]+$/, 'Use o formato campo ou -campo').optional(),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

/** Feed do app: ?cursor=...&per_page=20 */
export const cursorQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});
export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export interface PageResponse<T> {
  data: T[];
  meta: { page: number; per_page: number; total: number };
}
export interface CursorResponse<T> {
  data: T[];
  meta: { next_cursor: string | null };
}

export const pageOffset = (q: Pick<PageQuery, 'page' | 'per_page'>) => (q.page - 1) * q.per_page;

export function pageResponse<T>(data: T[], total: number, q: Pick<PageQuery, 'page' | 'per_page'>): PageResponse<T> {
  return { data, meta: { page: q.page, per_page: q.per_page, total } };
}

export function cursorResponse<T>(data: T[], nextCursor: string | null): CursorResponse<T> {
  return { data, meta: { next_cursor: nextCursor } };
}

/** O cursor é opaco para o cliente: um JSON em base64url. */
export const encodeCursor = (v: unknown): string => Buffer.from(JSON.stringify(v)).toString('base64url');

export function decodeCursor<T = unknown>(cursor: string): T {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    throw Erros.validacao([{ campo: 'cursor', mensagem: 'Cursor inválido' }]);
  }
}

/**
 * Converte "sort" em campo e direção, aceitando só colunas da lista branca
 * (nunca interpole o valor cru em SQL).
 */
export function parseSort(
  sort: string | undefined,
  permitidos: readonly string[],
  padrao: { campo: string; direcao: 'asc' | 'desc' },
): { campo: string; direcao: 'asc' | 'desc' } {
  if (!sort) return padrao;
  const direcao = sort.startsWith('-') ? 'desc' : 'asc';
  const campo = sort.replace(/^-/, '');
  if (!permitidos.includes(campo)) {
    throw Erros.validacao([{ campo: 'sort', mensagem: `Campo de ordenação inválido. Use: ${permitidos.join(', ')}` }]);
  }
  return { campo, direcao };
}
