import { PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';
import { Erros } from './errors';

/** Valida corpo, query ou parâmetro com um esquema Zod; erro vira 422 com errors[] por campo. */
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const r = this.schema.safeParse(value);
    if (r.success) return r.data;
    throw Erros.validacao(
      r.error.issues.map((i) => ({ campo: i.path.join('.') || '(corpo)', mensagem: i.message })),
    );
  }
}
