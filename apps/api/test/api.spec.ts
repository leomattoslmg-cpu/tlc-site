import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp, totalChamadas } from './helpers';

describe('padrões da API (FUN-04)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await criarApp();
  });
  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());

  it('GET /v1/health responde {status: ok}', async () => {
    const r = await http().get('/v1/health').expect(200);
    expect(r.body).toEqual({ status: 'ok' });
  });

  it('sem o prefixo /v1 a rota não existe', async () => {
    await http().get('/health').expect(404);
  });

  it('404 vem em RFC 9457', async () => {
    const r = await http().get('/v1/nada').expect(404);
    expect(r.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(r.body).toMatchObject({ status: 404, code: 'NOT_FOUND', instance: '/v1/nada' });
    expect(r.body.type).toBe('https://api.tlc.test/erros/not-found');
  });

  it('JSON malformado vira 400 INVALID_JSON', async () => {
    const r = await http().post('/v1/exemplo/validar').set('Content-Type', 'application/json').send('{ruim').expect(400);
    expect(r.body.code).toBe('INVALID_JSON');
  });

  it('validação devolve 422 com errors[] por campo', async () => {
    const r = await http().post('/v1/exemplo/validar').send({ nome: 'A', idade: 12 }).expect(422);
    expect(r.body.code).toBe('VALIDATION_ERROR');
    expect(r.body.errors).toEqual(
      expect.arrayContaining([
        { campo: 'nome', mensagem: 'Nome muito curto' },
        { campo: 'idade', mensagem: 'Idade mínima é 13 anos' },
      ]),
    );
  });

  it('corpo válido passa', async () => {
    await http().post('/v1/exemplo/validar').send({ nome: 'Ana', idade: 13 }).expect(201);
  });

  it('paginação usa defaults e devolve data e meta', async () => {
    const r = await http().get('/v1/exemplo/lista').expect(200);
    expect(r.body.meta).toEqual({ page: 1, per_page: 20, total: 134 });
    const r2 = await http().get('/v1/exemplo/lista?page=3&per_page=50').expect(200);
    expect(r2.body.meta).toEqual({ page: 3, per_page: 50, total: 134 });
  });

  it('paginação recusa per_page acima de 100, page 0 e sort fora da lista', async () => {
    await http().get('/v1/exemplo/lista?per_page=101').expect(422);
    await http().get('/v1/exemplo/lista?page=0').expect(422);
    const r = await http().get('/v1/exemplo/lista?sort=senha_hash').expect(422);
    expect(r.body.errors[0].campo).toBe('sort');
    await http().get('/v1/exemplo/lista?sort=-nome').expect(200);
  });

  describe('Idempotency-Key', () => {
    const chave = 'chave-0001-abcdef';
    it('repetir a mesma chave e corpo devolve a resposta original sem executar de novo', async () => {
      const a = await http().post('/v1/exemplo/inscricao').set('Idempotency-Key', chave).send({ evento: 1 }).expect(201);
      const antes = totalChamadas();
      const b = await http().post('/v1/exemplo/inscricao').set('Idempotency-Key', chave).send({ evento: 1 }).expect(201);
      expect(b.body).toEqual(a.body);
      expect(b.headers['idempotent-replayed']).toBe('true');
      expect(totalChamadas()).toBe(antes);
    });

    it('mesma chave com outro corpo dá 422', async () => {
      const r = await http().post('/v1/exemplo/inscricao').set('Idempotency-Key', chave).send({ evento: 2 }).expect(422);
      expect(r.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('chave em formato inválido dá 400', async () => {
      await http().post('/v1/exemplo/inscricao').set('Idempotency-Key', 'curta').send({}).expect(400);
    });

    it('sem a chave a rota funciona normalmente', async () => {
      await http().post('/v1/exemplo/inscricao').send({ evento: 3 }).expect(201);
    });

    it('erro não é guardado: a mesma chave pode ser reenviada', async () => {
      const k = 'chave-falha-abcdef';
      const r = await http().post('/v1/exemplo/inscricao').set('Idempotency-Key', k).send({ falhar: true }).expect(500);
      expect(r.body.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(r.body)).not.toContain('boom'); // não vaza detalhe interno
      const r2 = await http().post('/v1/exemplo/inscricao').set('Idempotency-Key', k).send({ falhar: true }).expect(500);
      expect(r2.headers['idempotent-replayed']).toBeUndefined();
    });
  });
});

describe('/v1/health/ready', () => {
  it('200 quando o banco responde, 503 quando não', async () => {
    const ok = await criarApp(true);
    await request(ok.getHttpServer()).get('/v1/health/ready').expect(200);
    await ok.close();
    const ruim = await criarApp(false);
    const r = await request(ruim.getHttpServer()).get('/v1/health/ready').expect(503);
    expect(r.body.banco).toBe('falha');
    await ruim.close();
  });
});
