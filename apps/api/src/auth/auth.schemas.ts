import { z } from 'zod';
import { cpfValido, soDigitos } from './cpf';

export const cpfSchema = z
  .string({ required_error: 'Informe o CPF' })
  .transform(soDigitos)
  .refine((v) => v.length === 11, 'O CPF tem 11 números')
  .refine((v) => v.length !== 11 || cpfValido(v), 'CPF inválido');

export const loginSchema = z.object({
  cpf: cpfSchema,
  senha: z.string({ required_error: 'Informe a senha' }).min(1, 'Informe a senha').max(200),
  dispositivo: z
    .object({
      plataforma: z.enum(['android', 'ios', 'web']),
      app_versao: z.string().max(30).optional(),
    })
    .optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refresh_token: z.string().min(20).max(200) });

export const trocarSenhaSchema = z.object({
  senha_atual: z.string().min(1, 'Informe a senha atual').max(200),
  senha_nova: z.string().min(1, 'Informe a nova senha').max(200),
});
export type TrocarSenhaInput = z.infer<typeof trocarSenhaSchema>;

export const atualizarDadosSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo').max(160),
  nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de nascimento'),
  email: z.string().trim().toLowerCase().email('Confira o e-mail'),
  telefone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Telefone com DDD, por exemplo (67) 99999-9999'),
  cidade: z.string().trim().min(2, 'Informe a cidade').max(80),
  comunidade: z.string().trim().min(2, 'Informe em qual comunidade você serve').max(100),
  edicao_tlc: z.string().trim().min(1, 'Informe qual TLC você fez').max(60),
});
export type AtualizarDadosInput = z.infer<typeof atualizarDadosSchema>;
