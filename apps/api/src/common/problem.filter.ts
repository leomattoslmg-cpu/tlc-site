import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError, FieldError } from './errors';

const PADRAO: Record<number, { code: string; title: string }> = {
  400: { code: 'BAD_REQUEST', title: 'Requisição inválida' },
  401: { code: 'UNAUTHENTICATED', title: 'Autenticação necessária' },
  403: { code: 'FORBIDDEN', title: 'Sem permissão para esta ação' },
  404: { code: 'NOT_FOUND', title: 'Recurso não encontrado' },
  405: { code: 'METHOD_NOT_ALLOWED', title: 'Método não permitido' },
  409: { code: 'CONFLICT', title: 'Conflito' },
  413: { code: 'PAYLOAD_TOO_LARGE', title: 'Conteúdo grande demais' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', title: 'Tipo de conteúdo não suportado' },
  422: { code: 'VALIDATION_ERROR', title: 'Dados inválidos' },
  429: { code: 'RATE_LIMITED', title: 'Muitas requisições' },
};

interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  errors?: FieldError[];
}

/** Converte qualquer exceção em application/problem+json (RFC 9457). */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly log = new Logger('Erro');

  constructor(private readonly baseUrl: string) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const p = this.mapear(exception);
    if (p.status >= 500) this.log.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    p.instance = req.path;
    if (exception instanceof AppError && exception.headers) res.set(exception.headers);
    res.status(p.status).type('application/problem+json').send(p);
  }

  private mapear(e: unknown): Problem {
    const tipo = (code: string) => `${this.baseUrl.replace(/\/$/, '')}/erros/${code.toLowerCase().replace(/_/g, '-')}`;

    if (e instanceof AppError) {
      return { type: tipo(e.code), title: e.title, status: e.status, code: e.code, detail: e.detail, errors: e.errors };
    }
    if (e instanceof HttpException) {
      const status = e.getStatus();
      // Versões novas do Nest embrulham o erro do body-parser (JSON malformado) numa HttpException 400.
      const causa = (e as { cause?: { type?: string } }).cause;
      if (status === 400 && (causa?.type === 'entity.parse.failed' || /JSON/i.test(e.message))) {
        return { type: tipo('INVALID_JSON'), title: 'JSON inválido', status: 400, code: 'INVALID_JSON' };
      }
      const base = PADRAO[status] ?? { code: 'ERROR', title: e.message };
      const r = e.getResponse();
      const detail = typeof r === 'string' ? r : undefined;
      return { type: tipo(base.code), title: base.title, status, code: base.code, detail };
    }
    // Erros do body-parser (JSON malformado, corpo grande demais) trazem status e type.
    const x = e as { status?: number; type?: string };
    if (typeof x?.status === 'number' && x.status >= 400 && x.status < 500) {
      const code = x.type === 'entity.parse.failed' ? 'INVALID_JSON' : (PADRAO[x.status]?.code ?? 'BAD_REQUEST');
      const title = x.type === 'entity.parse.failed' ? 'JSON inválido' : (PADRAO[x.status]?.title ?? 'Requisição inválida');
      return { type: tipo(code), title, status: x.status, code, };
    }
    return { type: tipo('INTERNAL_ERROR'), title: 'Erro interno', status: 500, code: 'INTERNAL_ERROR' };
  }
}
