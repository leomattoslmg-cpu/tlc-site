import { z } from 'zod';
import { cpfSchema } from '../auth/auth.schemas';
import { erroDeSenha } from '../auth/senha';

export const criarConviteSchema = z.object({
  validade_horas: z.number().int().min(1).max(24 * 30).default(72),
  max_usos: z.number().int().min(1).max(10_000).nullable().default(null),
});
export type CriarConviteInput = z.infer<typeof criarConviteSchema>;

export const cadastroSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo').max(160),
  cpf: cpfSchema,
  nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de nascimento'),
  edicao_tlc: z.string().trim().min(1, 'Informe qual TLC você fez').max(60),
  comunidade: z.string().trim().min(2, 'Informe em qual comunidade você serve').max(100),
  cidade: z.string().trim().min(2, 'Informe a cidade').max(80),
  telefone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Telefone com DDD, por exemplo (67) 99999-9999'),
  email: z.string().trim().toLowerCase().email('Confira o e-mail'),
  senha: z.string().superRefine((s, ctx) => {
    const e = erroDeSenha(s);
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e });
  }),
  termo_aceito: z.literal(true, { errorMap: () => ({ message: 'É preciso aceitar o uso dos dados para se cadastrar' }) }),
  captcha_token: z.string().min(1, 'Confirme que você não é um robô'),
});
export type CadastroInput = z.infer<typeof cadastroSchema>;
