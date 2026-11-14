import { BeginResult, IdempotencyStore } from './idempotency.store';

interface Registro {
  impressao: string;
  expira: number;
  concluido?: { status: number; corpo: unknown };
}

/** Só para desenvolvimento e testes: não é compartilhado entre instâncias. */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly dados = new Map<string, Registro>();

  async iniciar(chave: string, impressao: string, ttl: number): Promise<BeginResult> {
    const agora = Date.now();
    const atual = this.dados.get(chave);
    if (atual && atual.expira > agora) {
      if (atual.impressao !== impressao) return { estado: 'divergente' };
      if (atual.concluido) return { estado: 'concluido', ...atual.concluido };
      return { estado: 'em_andamento' };
    }
    this.dados.set(chave, { impressao, expira: agora + ttl * 1000 });
    return { estado: 'novo' };
  }

  async concluir(chave: string, impressao: string, status: number, corpo: unknown, ttl: number): Promise<void> {
    this.dados.set(chave, { impressao, expira: Date.now() + ttl * 1000, concluido: { status, corpo } });
  }

  async abandonar(chave: string): Promise<void> {
    this.dados.delete(chave);
  }
}
