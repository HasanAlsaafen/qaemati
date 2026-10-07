import { Global, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PostgresRateLimitStore } from './postgres-rate-limit-store';
import { MemoryRateLimitStore, RATE_LIMIT_STORE, RateLimitStore } from './rate-limit-store';

const PURGE_EVERY_MS = 10 * 60 * 1000;

/**
 * The database store everywhere except tests. Tests run several files at
 * once against one database and some of them hammer a limit on purpose, so
 * they keep an in memory store per app. The database store has its own test.
 */
@Global()
@Module({
  providers: [
    {
      provide: RATE_LIMIT_STORE,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): RateLimitStore =>
        process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_STORE !== 'postgres'
          ? new MemoryRateLimitStore()
          : new PostgresRateLimitStore(prisma),
    },
  ],
  exports: [RATE_LIMIT_STORE],
})
export class RateLimitModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitModule.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    const store = new PostgresRateLimitStore(this.prisma);
    this.timer = setInterval(() => {
      store.purgeExpired().catch((error) => this.logger.warn(`Purge failed: ${error}`));
    }, PURGE_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
