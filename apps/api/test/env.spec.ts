import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env';

describe('loadEnv', () => {
  it('aplica padrões e separa CORS_ORIGINS', () => {
    const e = loadEnv({ DATABASE_URL: 'postgres://a', CORS_ORIGINS: 'http://a.com, http://b.com' });
    expect(e.PORT).toBe(3000);
    expect(e.CORS_ORIGINS).toEqual(['http://a.com', 'http://b.com']);
  });
  it('falha sem DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });
});
