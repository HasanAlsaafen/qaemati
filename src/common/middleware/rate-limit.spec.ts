import { Request, Response } from 'express';
import { createRateLimiter } from './rate-limit';

function run(limiter: ReturnType<typeof createRateLimiter>, ip = '1.1.1.1', method = 'POST') {
  const next = jest.fn();
  limiter({ ip, method, path: '/x' } as Request, {} as Response, next);
  return next.mock.calls[0]?.[0] as { statusCode?: number } | undefined;
}

describe('createRateLimiter', () => {
  it('allows up to max requests then answers 429', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
    expect(run(limiter)).toBeUndefined();
    expect(run(limiter)).toBeUndefined();
    expect(run(limiter)?.statusCode).toBe(429);
  });

  it('counts each ip separately', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
    run(limiter, 'a');
    expect(run(limiter, 'b')).toBeUndefined();
  });

  it('starts a fresh window after windowMs', () => {
    let t = 0;
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });
    run(limiter);
    expect(run(limiter)?.statusCode).toBe(429);
    t = 1001;
    expect(run(limiter)).toBeUndefined();
  });

  it('ignores requests the matcher rejects', () => {
    const limiter = createRateLimiter({
      windowMs: 1000,
      max: 1,
      match: (r) => r.method === 'POST',
    });
    run(limiter, 'a', 'GET');
    run(limiter, 'a', 'GET');
    expect(run(limiter, 'a', 'GET')).toBeUndefined();
  });
});
