import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RateLimitStore } from './rate-limit-store';

/**
 * Counters in the database, so every instance behind a balancer and every
 * restart sees the same numbers. The clock is the database's, which keeps
 * instances with slightly different system times in agreement. One upsert
 * both counts and starts a fresh window, so concurrent hits never lose one.
 */
export class PostgresRateLimitStore implements RateLimitStore {
  constructor(private readonly prisma: PrismaService) {}

  async hit(key: string, windowMs: number): Promise<number> {
    const seconds = windowMs / 1000;
    const rows = await this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${seconds}))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN now() + make_interval(secs => ${seconds}) ELSE "RateLimitBucket"."resetAt" END
      RETURNING "count"
    `);
    return Number(rows[0].count);
  }

  async count(key: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT "count" FROM "RateLimitBucket" WHERE "key" = ${key} AND "resetAt" > now()
    `);
    return rows[0] ? Number(rows[0].count) : 0;
  }

  async reset(key: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`DELETE FROM "RateLimitBucket" WHERE "key" = ${key}`);
  }

  async purgeExpired(): Promise<number> {
    return this.prisma.$executeRaw(
      Prisma.sql`DELETE FROM "RateLimitBucket" WHERE "resetAt" <= now()`,
    );
  }
}
