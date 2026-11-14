import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { ENV, Env } from '../config/env';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool: Pool;

  constructor(@Inject(ENV) env: Env) {
    // O driver já traduz timestamptz para Date em UTC; a exibição em America/Campo_Grande é do cliente.
    this.pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  }

  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
