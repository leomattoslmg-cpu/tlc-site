import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { ENV, Env } from '../config/env';
import { AppError } from '../common/errors';

interface Chaves {
  jwt: Buffer;
  cpfAes: Buffer;
  cpfHmac: Buffer;
}

export interface JwtPayload {
  sub: string; // id do usuário
  sid: string; // id da sessão
  per: string[]; // perfis
  iat: number;
  exp: number;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * Chaves derivadas de um único segredo (APP_SEGREDO) e usadas para:
 * - assinar o token de acesso (HS256);
 * - cifrar o CPF (AES-256-GCM, RN: cpf_cifrado);
 * - gerar o hash do CPF para busca e login (HMAC-SHA-256, cpf_hash).
 */
@Injectable()
export class CryptoService {
  private cache?: Chaves;

  constructor(@Inject(ENV) private readonly env: Env) {}

  private chaves(): Chaves {
    if (this.cache) return this.cache;
    let segredo = this.env.APP_SEGREDO;
    if (!segredo) {
      if (this.env.NODE_ENV === 'production') {
        throw new AppError(503, 'AUTH_NOT_CONFIGURED', 'Login indisponível', 'O servidor ainda não foi configurado para login (falta APP_SEGREDO).');
      }
      segredo = 'segredo-de-desenvolvimento-nao-usar-em-producao';
    }
    const derivar = (info: string) => Buffer.from(hkdfSync('sha256', segredo, 'tlc-v1', info, 32));
    return (this.cache = { jwt: derivar('jwt'), cpfAes: derivar('cpf-aes'), cpfHmac: derivar('cpf-hmac') });
  }

  /** Hash do CPF (só dígitos) para procurar o membro sem guardar o CPF em claro. */
  hashCpf(cpf: string): Buffer {
    return createHmac('sha256', this.chaves().cpfHmac).update(cpf).digest();
  }

  /** iv (12) + tag (16) + texto cifrado. */
  cifrarCpf(cpf: string): Buffer {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.chaves().cpfAes, iv);
    const enc = Buffer.concat([c.update(cpf, 'utf8'), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), enc]);
  }

  decifrarCpf(dado: Buffer): string {
    const d = createDecipheriv('aes-256-gcm', this.chaves().cpfAes, dado.subarray(0, 12));
    d.setAuthTag(dado.subarray(12, 28));
    return Buffer.concat([d.update(dado.subarray(28)), d.final()]).toString('utf8');
  }

  assinar(dados: Omit<JwtPayload, 'iat' | 'exp'>, validadeSegundos: number, agora = Math.floor(Date.now() / 1000)): string {
    const corpo = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ ...dados, iat: agora, exp: agora + validadeSegundos }))}`;
    return `${corpo}.${b64(createHmac('sha256', this.chaves().jwt).update(corpo).digest())}`;
  }

  /** Devolve o conteúdo se a assinatura e a validade estiverem corretas; senão, null. */
  verificar(token: string, agora = Math.floor(Date.now() / 1000)): JwtPayload | null {
    const partes = token.split('.');
    if (partes.length !== 3) return null;
    try {
      const cabecalho = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8')) as { alg?: string };
      if (cabecalho.alg !== 'HS256') return null; // nunca aceita "none" nem outro algoritmo
      const esperado = createHmac('sha256', this.chaves().jwt).update(`${partes[0]}.${partes[1]}`).digest();
      const recebido = Buffer.from(partes[2], 'base64url');
      if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return null;
      const p = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')) as JwtPayload;
      return typeof p.exp === 'number' && p.exp > agora && typeof p.sub === 'string' && typeof p.sid === 'string' ? p : null;
    } catch (e) {
      if (e instanceof AppError) throw e;
      return null;
    }
  }
}
