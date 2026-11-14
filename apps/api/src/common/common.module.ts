import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, Env } from '../config/env';
import { IDEMPOTENCY_STORE } from './idempotency/idempotency.store';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';
import { MemoryIdempotencyStore } from './idempotency/memory.store';
import { RedisIdempotencyStore } from './idempotency/redis.store';

@Global()
@Module({
  providers: [
    {
      provide: IDEMPOTENCY_STORE,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (env.REDIS_URL) return new RedisIdempotencyStore(new Redis(env.REDIS_URL));
        if (env.NODE_ENV === 'production') {
          new Logger('Idempotência').warn('REDIS_URL ausente em produção: usando memória, que não é compartilhada entre instâncias');
        }
        return new MemoryIdempotencyStore();
      },
    },
    IdempotencyInterceptor,
  ],
  exports: [IDEMPOTENCY_STORE, IdempotencyInterceptor],
})
export class CommonModule {}
