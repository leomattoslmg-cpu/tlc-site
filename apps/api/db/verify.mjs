// Confere o resultado da FUN-03: 35 tabelas e dados iniciais.
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const n = async (sql) => Number((await client.query(sql)).rows[0].n);
const checks = [
  ['tabelas (sem schema_migrations)', `SELECT count(*) n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name<>'schema_migrations'`, 36],
  ['perfis', 'SELECT count(*) n FROM perfis', 10],
  ['permissões', 'SELECT count(*) n FROM permissoes', 35],
  ['organização', 'SELECT count(*) n FROM organizacoes', 1],
];
let falhou = false;
for (const [nome, sql, esperado] of checks) {
  const obtido = await n(sql);
  const ok = obtido === esperado;
  falhou ||= !ok;
  console.log(`${ok ? 'OK  ' : 'ERRO'} ${nome}: ${obtido} (esperado ${esperado})`);
}
const cat = await n('SELECT count(*) n FROM categorias_aviso');
console.log(`INFO categorias de aviso: ${cat}`);
await client.end();
process.exit(falhou ? 1 : 0);
