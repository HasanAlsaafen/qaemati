import { Request, Response } from 'express';
import { MemoryRateLimitStore, RateLimitStore } from '../rate-limit/rate-limit-store';
import { createRateLimiter } from './rate-limit';

async function run(
  limiter: ReturnType<typeof createRateLimiter>,
  ip = '1.1.1.1',
  method = 'POST',
): Promise<{ statusCode?: number } | undefined> {
  const next = jest.fn();
  await limiter({ ip, method, path: '/x' } as Request, {} as Response, next);
  return next.mock.calls[0]?.[0];
}

describe('createRateLimiter', () => {
  it('allows up to max requests then answers 429', async () => {
    const limiter = createRateLimiter(new MemoryRateLimitStore(), {
      name: 't',
      windowMs: 1000,
      max: 2,
    });
    expect(await run(limiter)).toBeUndefined();
    expect(await run(limiter)).toBeUndefined();
    expect((await run(limiter))?.statusCode).toBe(429);
  });

  it('counts each client separately', async () => {
    const limiter = createRateLimiter(new MemoryRateLimitStore(), {
      name: 't',
      windowMs: 1000,
      max: 1,
    });
    expect(await run(limiter, 'a')).toBeUndefined();
    expect(await run(limiter, 'b')).toBeUndefined();
    expect((await run(limiter, 'a'))?.statusCode).toBe(429);
  });

  it('starts a new window once the old one ends', async () => {
    let t = 0;
    const limiter = createRateLimiter(new MemoryRateLimitStore(() => t), {
      name: 't',
      windowMs: 1000,
      max: 1,
    });
    await run(limiter);
    expect((await run(limiter))?.statusCode).toBe(429);
    t = 1001;
    expect(await run(limiter)).toBeUndefined();
  });

  it('keeps two limits that share a store apart', async () => {
    const store = new MemoryRateLimitStore();
    const a = createRateLimiter(store, { name: 'a', windowMs: 1000, max: 1 });
    const b = createRateLimiter(store, { name: 'b', windowMs: 1000, max: 1 });
    await run(a);
    expect((await run(a))?.statusCode).toBe(429);
    expect(await run(b)).toBeUndefined();
  });

  it('ignores requests the matcher rejects', async () => {
    const limiter = createRateLimiter(new MemoryRateLimitStore(), {
      name: 't',
      windowMs: 1000,
      max: 1,
      match: (r) => r.method === 'POST',
    });
    await run(limiter, 'a', 'GET');
    await run(limiter, 'a', 'GET');
    expect(await run(limiter, 'a', 'GET')).toBeUndefined();
  });

  it('lets the request through when the store fails', async () => {
    const broken: RateLimitStore = {
      hit: () => Promise.reject(new Error('db down')),
      count: () => Promise.reject(new Error('db down')),
      reset: () => Promise.reject(new Error('db down')),
    };
    const limiter = createRateLimiter(broken, { name: 't', windowMs: 1000, max: 1 });
    expect(await run(limiter)).toBeUndefined();
  });
});
