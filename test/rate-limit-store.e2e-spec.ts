import { Test } from '@nestjs/testing';
import { PostgresRateLimitStore } from '../src/common/rate-limit/postgres-rate-limit-store';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PostgresRateLimitStore (e2e)', () => {
  let prisma: PrismaService;
  let moduleClose: () => Promise<void>;
  const prefix = `store-test-${Date.now().toString(36)}`;
  const k = (name: string) => `${prefix}:${name}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    moduleClose = () => moduleRef.close();
  });

  afterAll(async () => {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: prefix } } });
    await moduleClose();
  });

  it('counts hits within a window and reports the count without adding to it', async () => {
    const store = new PostgresRateLimitStore(prisma);
    expect(await store.count(k('a'))).toBe(0);
    expect(await store.hit(k('a'), 60_000)).toBe(1);
    expect(await store.hit(k('a'), 60_000)).toBe(2);
    expect(await store.count(k('a'))).toBe(2);
    expect(await store.count(k('a'))).toBe(2);
  });

  it('shares counts between separate instances and survives a new one, as a restart or a second server would', async () => {
    await new PostgresRateLimitStore(prisma).hit(k('shared'), 60_000);
    await new PostgresRateLimitStore(prisma).hit(k('shared'), 60_000);
    expect(await new PostgresRateLimitStore(prisma).count(k('shared'))).toBe(2);
  });

  it('does not lose hits that arrive at the same moment', async () => {
    const store = new PostgresRateLimitStore(prisma);
    const counts = await Promise.all(
      Array.from({ length: 25 }, () => store.hit(k('race'), 60_000)),
    );
    expect([...counts].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it('starts a new window once the old one has ended', async () => {
    const store = new PostgresRateLimitStore(prisma);
    await store.hit(k('expire'), 60_000);
    await store.hit(k('expire'), 60_000);
    await prisma.rateLimitBucket.update({
      where: { key: k('expire') },
      data: { resetAt: new Date(Date.now() - 1000) },
    });
    expect(await store.count(k('expire'))).toBe(0);
    expect(await store.hit(k('expire'), 60_000)).toBe(1);
  });

  it('resets one key and leaves the others', async () => {
    const store = new PostgresRateLimitStore(prisma);
    await store.hit(k('x'), 60_000);
    await store.hit(k('y'), 60_000);
    await store.reset(k('x'));
    expect(await store.count(k('x'))).toBe(0);
    expect(await store.count(k('y'))).toBe(1);
  });

  it('purges only expired rows', async () => {
    const store = new PostgresRateLimitStore(prisma);
    await store.hit(k('old'), 60_000);
    await store.hit(k('new'), 60_000);
    await prisma.rateLimitBucket.update({
      where: { key: k('old') },
      data: { resetAt: new Date(Date.now() - 1000) },
    });
    await store.purgeExpired();
    expect(await prisma.rateLimitBucket.findUnique({ where: { key: k('old') } })).toBeNull();
    expect(await store.count(k('new'))).toBe(1);
  });
});
