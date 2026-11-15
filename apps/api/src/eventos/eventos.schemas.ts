import { z } from 'zod';

const dataHora = z.string({ required_error: 'Obrigatório' }).datetime({ offset: true, message: 'Data e hora inválidas' });

export const criarEventoSchema = z
  .object({
    nome: z.string().trim().min(3, 'Informe o nome do evento').max(120),
    descricao: z.string().trim().max(2000).optional(),
    inicio_em: dataHora,
    fim_em: dataHora,
    local_nome: z.string().trim().max(160).optional(),
    publico_no_site: z.boolean().default(false),
  })
  .refine((v) => new Date(v.fim_em).getTime() >= new Date(v.inicio_em).getTime(), {
    path: ['fim_em'],
    message: 'O fim precisa ser depois do início',
  });
export type CriarEventoInput = z.infer<typeof criarEventoSchema>;

export const idSchema = z.string().uuid('Identificador inválido');
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,80}$/, 'Código inválido');
export const anoSchema = z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear());
