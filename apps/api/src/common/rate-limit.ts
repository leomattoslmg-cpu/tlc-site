import { Erros } from './errors';

/**
 * Limite por janela deslizante, em memória (vale por instância da API).
 * Serve de proteção básica; para limite global entre instâncias, troque por Redis.
 */
export class RateLimiter {
  private readonly acessos = new Map<string, number[]>();

  constructor(
    private readonly limite: number,
    private readonly janelaMs: number,
  ) {}

  /** Registra um acesso e lança 429 (com Retry-After) se passou do limite. */
  consumir(chave: string, agora = Date.now()): void {
    const recentes = (this.acessos.get(chave) ?? []).filter((t) => agora - t < this.janelaMs);
    if (recentes.length >= this.limite) {
      const segundos = Math.max(1, Math.ceil((recentes[0] + this.janelaMs - agora) / 1000));
      this.acessos.set(chave, recentes);
      throw Erros.limite(segundos);
    }
    recentes.push(agora);
    this.acessos.set(chave, recentes);
    if (this.acessos.size > 10_000) this.limpar(agora); // evita crescer sem fim
  }

  private limpar(agora: number): void {
    for (const [k, v] of this.acessos) if (v.every((t) => agora - t >= this.janelaMs)) this.acessos.delete(k);
  }
}
