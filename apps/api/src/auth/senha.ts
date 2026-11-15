import { hash, verify } from '@node-rs/argon2';

// Argon2id (o padrão da biblioteca) com os parâmetros mínimos recomendados pela OWASP:
// 19 MiB de memória, 2 passadas, 1 thread.
const OPCOES = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashSenha = (senha: string): Promise<string> => hash(senha, OPCOES);

export async function conferirSenha(hashGuardado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, senha);
  } catch {
    return false; // hash corrompido ou em formato inesperado
  }
}

const COMUNS = new Set(['12345678', '123456789', '1234567890', 'senha123', 'password1', 'qwerty123', 'abc12345', 'senha1234', 'brasil123', 'mudar123']);

/** RN-AUT-03: mínimo de 8 caracteres, ao menos 1 letra e 1 número, fora de uma lista de senhas comuns. */
export function erroDeSenha(senha: string): string | null {
  if (senha.length < 8) return 'A senha precisa ter ao menos 8 caracteres';
  if (!/[A-Za-zÀ-ÿ]/.test(senha)) return 'A senha precisa ter ao menos 1 letra';
  if (!/\d/.test(senha)) return 'A senha precisa ter ao menos 1 número';
  if (COMUNS.has(senha.toLowerCase())) return 'Essa senha é muito comum; escolha outra';
  return null;
}
