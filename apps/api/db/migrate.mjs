// Executor de migrações SQL: aplica, em ordem, os arquivos de db/migrations
// que ainda não constam em schema_migrations. Cada arquivo roda em uma transação.
// Uso: DATABASE_URL=postgres://... node db/migrate.mjs
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  // Evita duas execuções simultâneas (ex.: dois deploys).
  await client.query('SELECT pg_advisory_lock(727001)');
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nome text PRIMARY KEY,
    checksum text NOT NULL,
    aplicada_em timestamptz NOT NULL DEFAULT now())`);
  const aplicadas = new Map(
    (await client.query('SELECT nome, checksum FROM schema_migrations')).rows.map((r) => [r.nome, r.checksum]),
  );
  const arquivos = (await readdir(dir)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
  let novas = 0;
  for (const nome of arquivos) {
    const sql = await readFile(join(dir, nome), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    if (aplicadas.has(nome)) {
      if (aplicadas.get(nome) !== checksum) {
        throw new Error(`Migração ${nome} foi alterada depois de aplicada. Crie uma nova migração.`);
      }
      continue;
    }
    console.log(`Aplicando ${nome}...`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (nome, checksum) VALUES ($1, $2)', [nome, checksum]);
      await client.query('COMMIT');
      novas++;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  }
  console.log(novas ? `${novas} migração(ões) aplicada(s).` : 'Banco já está atualizado.');
} finally {
  await client.end();
}
