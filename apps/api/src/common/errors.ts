export interface FieldError {
  campo: string;
  mensagem: string;
}

/** Erro de negócio que vira uma resposta RFC 9457 (application/problem+json). */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly title: string,
    public readonly detail?: string,
    public readonly errors?: FieldError[],
  ) {
    super(detail ?? title);
  }
}

export const Erros = {
  validacao: (errors: FieldError[]) => new AppError(422, 'VALIDATION_ERROR', 'Dados inválidos', undefined, errors),
  naoEncontrado: (detail?: string) => new AppError(404, 'NOT_FOUND', 'Recurso não encontrado', detail),
  naoAutenticado: () => new AppError(401, 'UNAUTHENTICATED', 'Autenticação necessária'),
  semPermissao: () => new AppError(403, 'FORBIDDEN', 'Sem permissão para esta ação'),
  conflito: (detail?: string) => new AppError(409, 'CONFLICT', 'Conflito', detail),
};
