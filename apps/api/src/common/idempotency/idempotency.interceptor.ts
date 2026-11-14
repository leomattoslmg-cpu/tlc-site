import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { Observable, catchError, from, mergeMap, of, throwError } from 'rxjs';
import { AppError } from '../errors';
import { IDEMPOTENCY_STORE, IdempotencyStore } from './idempotency.store';

const TTL_SEGUNDOS = 24 * 60 * 60;
const FORMATO_CHAVE = /^[A-Za-z0-9_\-:.]{8,128}$/;

/**
 * Repetição segura (cabeçalho Idempotency-Key), usada em inscrição e check-in.
 * - Sem o cabeçalho: a requisição segue normalmente.
 * - Mesma chave e mesmo corpo: devolve a resposta original (Idempotent-Replayed: true).
 * - Mesma chave com outro corpo: 422. Chave ainda em execução: 409.
 * - Respostas de erro não são guardadas, então o cliente pode tentar de novo.
 * Uso: @UseInterceptors(IdempotencyInterceptor) na rota.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { user?: { id?: string } }>();
    const res = http.getResponse<Response>();

    const cabecalho = req.header('idempotency-key');
    if (cabecalho === undefined) return next.handle();
    if (!FORMATO_CHAVE.test(cabecalho)) {
      throw new AppError(400, 'IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key inválida', 'Use de 8 a 128 caracteres: letras, números e _ - : .');
    }

    // A chave vale por usuário (ou IP, se não autenticado), método e rota.
    const dono = req.user?.id ?? req.ip ?? 'anonimo';
    const chave = `${dono}:${req.method}:${req.path}:${cabecalho}`;
    const impressao = createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex');

    const r = await this.store.iniciar(chave, impressao, TTL_SEGUNDOS);
    switch (r.estado) {
      case 'divergente':
        throw new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key já usada com outro conteúdo');
      case 'em_andamento':
        throw new AppError(409, 'IDEMPOTENCY_IN_PROGRESS', 'Requisição em andamento', 'Aguarde e tente novamente');
      case 'concluido':
        res.status(r.status).setHeader('Idempotent-Replayed', 'true');
        return of(r.corpo);
      case 'novo':
        return next.handle().pipe(
          mergeMap(async (corpo) => {
            await this.store.concluir(chave, impressao, res.statusCode, corpo, TTL_SEGUNDOS);
            return corpo;
          }),
          catchError((err) => from(this.store.abandonar(chave)).pipe(mergeMap(() => throwError(() => err)))),
        );
    }
  }
}
