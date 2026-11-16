import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../src/app.factory';
import { CommonModule } from '../src/common/common.module';
import { RateLimiter } from '../src/common/rate-limit';
import { ConfigModule } from '../src/config/config.module';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { SiteModule } from '../src/site/site.module';

process.env.DATABASE_URL ??= 'postgres://x:x@localhost:5432/x';
process.env.NODE_ENV = 'test';
process.env.CDN_BASE_URL = 'https://cdn.tlc.test';

const consultas: { sql: string; params?: unknown[] }[] = [];
const respostas: Record<string, unknown[]> = {};
const db = {
  ping: async () => true,
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params });
    if (sql.includes('FROM organizacoes')) return { rows: [{ id: 'org-1' }] };
    const chave = Object.keys(respostas).find((k) => sql.includes(k));
    return { rows: chave ? respostas[chave] : [] };
  }),
};

describe('rotas públicas do site', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [ConfigModule, DatabaseModule, CommonModule, SiteModule] })
      .overrideProvider(DatabaseService)
      .useValue(db)
      .compile();
    app = mod.createNestApplication();
    configureApp(app, { API_PUBLIC_URL: 'https://api.tlc.test', CORS_ORIGINS: [] });
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    consultas.length = 0;
    for (const k of Object.keys(respostas)) delete respostas[k];
  });
  const http = () => request(app.getHttpServer());

  it('página publicada devolve o conteúdo e usa cache', async () => {
    respostas['FROM paginas_site'] = [{ slug: 'quem-somos', titulo: 'Quem Somos', conteudo: 'x', publicado: true }];
    const r = await http().get('/v1/public/paginas/quem-somos').expect(200);
    expect(r.body.titulo).toBe('Quem Somos');
    expect(r.headers['cache-control']).toMatch(/max-age=60/);
  });

  it('página inexistente ou não publicada dá 404; slug inválido dá 422', async () => {
    const r = await http().get('/v1/public/paginas/historia').expect(404);
    expect(r.body.code).toBe('NOT_FOUND');
    await http().get('/v1/public/paginas/Quem Somos!').expect(422);
  });

  it('eventos: monta imagem_url com o CDN e filtra só públicos no SQL', async () => {
    respostas['FROM eventos'] = [{ id: '1', nome: 'Culto', status: 'inscricoes_abertas', chave_storage: 'img/a.jpg' }, { id: '2', nome: 'Sem foto', status: 'encerrado', chave_storage: null }];
    const r = await http().get('/v1/public/eventos').expect(200);
    expect(r.body.data[0].imagem_url).toBe('https://cdn.tlc.test/img/a.jpg');
    expect(r.body.data[1].imagem_url).toBeNull();
    expect(r.body.data[0]).not.toHaveProperty('chave_storage');
    const sql = consultas.find((c) => c.sql.includes('FROM eventos'))!.sql;
    expect(sql).toContain('publico_no_site');
    expect(sql).toContain("<> 'rascunho'");
  });

  it('álbuns: só públicos e publicados, com capa_url', async () => {
    respostas['FROM albuns'] = [{ id: 'a', titulo: 'Álbum', total_fotos: 2, chave_storage: 'img/c.jpg' }];
    const r = await http().get('/v1/public/albuns').expect(200);
    expect(r.body.data[0].capa_url).toBe('https://cdn.tlc.test/img/c.jpg');
    const sql = consultas.find((c) => c.sql.includes('FROM albuns'))!.sql;
    expect(sql).toContain("visibilidade = 'publico'");
    expect(sql).toContain("status = 'publicado'");
  });

  describe('POST /public/contato', () => {
    const valido = { nome: 'Ana Souza', email: 'ANA@Exemplo.com', assunto: 'Dúvida', mensagem: 'Gostaria de saber mais sobre o TLC.', captcha_token: 'x' };

    it('grava a mensagem e responde 202', async () => {
      const r = await http().post('/v1/public/contato').send(valido).expect(202);
      expect(r.body).toEqual({ status: 'recebida' });
      const ins = consultas.find((c) => c.sql.includes('INSERT INTO mensagens_contato'))!;
      expect(ins.params).toEqual(['org-1', 'Ana Souza', 'ana@exemplo.com', null, 'Dúvida', 'Gostaria de saber mais sobre o TLC.']);
    });

    it('422 com errors[] por campo; telefone precisa estar em E.164', async () => {
      const r = await http().post('/v1/public/contato').send({ ...valido, nome: 'A', email: 'x', telefone: '67999990001', mensagem: 'curta' }).expect(422);
      const campos = r.body.errors.map((e: { campo: string }) => e.campo).sort();
      expect(campos).toEqual(['email', 'mensagem', 'nome', 'telefone']);
      expect(consultas.some((c) => c.sql.includes('INSERT'))).toBe(false);
    });

    it('sem captcha_token dá 422 e não grava', async () => {
      const semToken: Record<string, unknown> = { ...valido };
      delete semToken.captcha_token;
      await http().post('/v1/public/contato').send(semToken).expect(422);
    });

    it('depois de 5 mensagens do mesmo IP, a 6ª dá 429 com Retry-After', async () => {
      let ultimo = await http().post('/v1/public/contato').send(valido);
      for (let i = 0; i < 6 && ultimo.status === 202; i++) ultimo = await http().post('/v1/public/contato').send(valido);
      expect(ultimo.status).toBe(429);
      expect(ultimo.body.code).toBe('RATE_LIMITED');
      expect(Number(ultimo.headers['retry-after'])).toBeGreaterThan(0);
    });
  });
});

describe('RateLimiter', () => {
  it('libera de novo quando a janela passa', () => {
    const rl = new RateLimiter(2, 1000);
    rl.consumir('ip', 0);
    rl.consumir('ip', 100);
    expect(() => rl.consumir('ip', 200)).toThrow();
    expect(() => rl.consumir('ip', 1101)).not.toThrow();
    expect(() => rl.consumir('outro', 200)).not.toThrow();
  });
});
