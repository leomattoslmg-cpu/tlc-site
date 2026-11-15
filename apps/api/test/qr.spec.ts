import { describe, expect, it } from 'vitest';
import { cadastroSchema, criarConviteSchema } from '../src/cadastro/cadastro.schemas';
import { criarEventoSchema } from '../src/eventos/eventos.schemas';

describe('evento', () => {
  it('aceita data com fuso de Campo Grande e recusa fim antes do início', () => {
    const ok = criarEventoSchema.safeParse({ nome: 'Formação', inicio_em: '2026-12-13T08:00:00-04:00', fim_em: '2026-12-13T12:00:00-04:00' });
    expect(ok.success).toBe(true);
    const ruim = criarEventoSchema.safeParse({ nome: 'Formação', inicio_em: '2026-12-13T12:00:00-04:00', fim_em: '2026-12-13T08:00:00-04:00' });
    expect(ruim.success).toBe(false);
  });
});

describe('convite e cadastro', () => {
  it('convite tem padrões (72 h, sem limite)', () => {
    expect(criarConviteSchema.parse({})).toEqual({ validade_horas: 72, max_usos: null });
  });
  it('cadastro exige aceite, CPF válido e senha forte', () => {
    const base = { nome: 'Maria Silva', cpf: '529.982.247-25', nascimento: '2000-01-01', telefone: '+5567999990001', email: 'm@x.com', senha: 'Servir2026', termo_aceito: true, captcha_token: 't' };
    expect(cadastroSchema.safeParse(base).success).toBe(true);
    expect(cadastroSchema.safeParse({ ...base, termo_aceito: false }).success).toBe(false);
    expect(cadastroSchema.safeParse({ ...base, cpf: '111.111.111-11' }).success).toBe(false);
    expect(cadastroSchema.safeParse({ ...base, senha: 'abc' }).success).toBe(false);
  });
});
