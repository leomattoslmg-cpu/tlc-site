export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');

export type BeginResult =
  | { estado: 'novo' }
  | { estado: 'em_andamento' }
  | { estado: 'divergente' } // mesma chave com outro corpo
  | { estado: 'concluido'; status: number; corpo: unknown };

export interface IdempotencyStore {
  /** Reserva a chave. Só uma requisição por chave recebe 'novo'. */
  iniciar(chave: string, impressao: string, ttlSegundos: number): Promise<BeginResult>;
  concluir(chave: string, impressao: string, status: number, corpo: unknown, ttlSegundos: number): Promise<void>;
  /** Libera a chave quando a execução falhou, para o cliente poder tentar de novo. */
  abandonar(chave: string): Promise<void>;
}
