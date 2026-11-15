import { describe, expect, it } from 'vitest';
import { cpfValido, mascararCpf, soDigitos } from '../src/auth/cpf';
import { erroDeSenha } from '../src/auth/senha';
import { CryptoService } from '../src/auth/crypto.service';

const env = { NODE_ENV: 'test', APP_SEGREDO: 'x'.repeat(40) } as never;

describe('CPF', () => {
  it('valida dígitos verificadores', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('52998224724')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
  });
  it('mascara e limpa', () => {
    expect(mascararCpf('529.982.247-25')).toBe('***.982.247-**');
    expect(soDigitos('529.982.247-25')).toBe('52998224725');
  });
});

describe('senha (RN-AUT-03)', () => {
  it('exige 8 caracteres, letra e número', () => {
    expect(erroDeSenha('abc123')).not.toBeNull();
    expect(erroDeSenha('abcdefgh')).not.toBeNull();
    expect(erroDeSenha('12345678')).not.toBeNull();
    expect(erroDeSenha('Servir2026')).toBeNull();
  });
});

describe('CryptoService', () => {
  const c = new CryptoService(env);
  it('cifra e decifra o CPF', () => {
    expect(c.decifrarCpf(c.cifrarCpf('52998224725'))).toBe('52998224725');
  });
  it('hash do CPF é estável', () => {
    expect(c.hashCpf('52998224725').equals(c.hashCpf('52998224725'))).toBe(true);
    expect(c.hashCpf('52998224725').equals(c.hashCpf('52998224726'))).toBe(false);
  });
  it('JWT: aceita válido, recusa expirado, adulterado e alg none', () => {
    const t = c.assinar({ sub: 'u', sid: 's', per: ['membro'] }, 60, 1000);
    expect(c.verificar(t, 1030)?.sub).toBe('u');
    expect(c.verificar(t, 1061)).toBeNull();
    const [h, p, s] = t.split('.');
    const forjado = Buffer.from(JSON.stringify({ sub: 'u', sid: 's', per: ['super_admin'], exp: 9999999999 })).toString('base64url');
    expect(c.verificar(`${h}.${forjado}.${s}`, 1030)).toBeNull();
    const none = Buffer.from('{"alg":"none"}').toString('base64url');
    expect(c.verificar(`${none}.${p}.`, 1030)).toBeNull();
  });
});
