import type Redis from 'ioredis';
import { BeginResult, IdempotencyStore } from './idempotency.store';

interface Valor {
  impressao: string;
  concluido?: { status: number; corpo: unknown };
}

/** Compartilhado entre instâncias da API; usa SET NX para reservar a chave. */
export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(private readonly redis: Redis) {}

  private k = (chave: string) => `idem:${chave}`;

  async iniciar(chave: string, impressao: string, ttl: number): Promise<BeginResult> {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const ok = await this.redis.set(this.k(chave), JSON.stringify({ impressao } satisfies Valor), 'EX', ttl, 'NX');
      if (ok === 'OK') return { estado: 'novo' };
      const raw = await this.redis.get(this.k(chave));
      if (raw === null) continue; // expirou entre o SET e o GET
      const v = JSON.parse(raw) as Valor;
      if (v.impressao !== impressao) return { estado: 'divergente' };
      if (v.concluido) return { estado: 'concluido', ...v.concluido };
      return { estado: 'em_andamento' };
    }
    return { estado: 'em_andamento' };
  }

  async concluir(chave: string, impressao: string, status: number, corpo: unknown, ttl: number): Promise<void> {
    await this.redis.set(this.k(chave), JSON.stringify({ impressao, concluido: { status, corpo } } satisfies Valor), 'EX', ttl);
  }

  async abandonar(chave: string): Promise<void> {
    await this.redis.del(this.k(chave));
  }
}
