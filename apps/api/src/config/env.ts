import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
});

export type Env = z.infer<typeof schema>;
export const ENV = Symbol('ENV');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const r = schema.safeParse(source);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuração inválida: ${msg}`);
  }
  return r.data;
}
