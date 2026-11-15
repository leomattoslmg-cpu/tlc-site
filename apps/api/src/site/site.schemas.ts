import { z } from 'zod';

/** Telefone em E.164 (+5567999990001), como no OpenAPI. */
const telefone = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Telefone com DDD, por exemplo +5567999990001');

export const contatoSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome').max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(254),
  telefone: telefone.optional(),
  assunto: z.string().trim().min(3, 'Diga o assunto em poucas palavras').max(150),
  mensagem: z.string().trim().min(10, 'Escreva um pouco mais').max(2000, 'A mensagem pode ter até 2.000 caracteres'),
  captcha_token: z.string().min(1, 'Confirme que você não é um robô').max(4096),
});
export type ContatoInput = z.infer<typeof contatoSchema>;

export const slugSchema = z.string().regex(/^[a-z0-9-]{1,60}$/, 'Página inválida');
