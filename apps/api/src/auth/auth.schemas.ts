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
