import { z } from 'zod';

export const avisoSchema = z.object({
  titulo: z.string().trim().min(3, 'Informe o título').max(120, 'Título muito longo'),
  conteudo: z.string().trim().min(3, 'Escreva o aviso').max(5000, 'Texto muito longo (máximo 5000 letras)'),
  categoria: z.enum(['geral', 'eventos', 'coordenacao', 'importante'], { errorMap: () => ({ message: 'Escolha a categoria' }) }),
  publico_alvo: z.enum(['todos', 'membros', 'coordenacao']).default('membros'),
  fixado: z.boolean().default(false),
});
export type AvisoInput = z.infer<typeof avisoSchema>;

export const editarAvisoSchema = avisoSchema.extend({ status: z.enum(['publicado', 'arquivado']).default('publicado') });
export type EditarAvisoInput = z.infer<typeof editarAvisoSchema>;
