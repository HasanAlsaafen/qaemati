import { MemoryRateLimitStore, RateLimitStore } from '../common/rate-limit/rate-limit-store';
import { LoginRateLimiter } from './login-rate-limiter';

describe('LoginRateLimiter', () => {
  let now: number;
  let limiter: LoginRateLimiter;

  beforeEach(() => {
    now = 1_000_000;
    limiter = new LoginRateLimiter(new MemoryRateLimitStore(() => now));
  });

  const fail = async (key: string, times: number) => {
    for (let i = 0; i < times; i++) await limiter.recordFailure(key);
  };

  it('is not blocked before any failures', async () => {
    expect(await limiter.isBlocked('1.2.3.4:a@b.com')).toBe(false);
  });

  it('blocks after 5 failures within the window', async () => {
    const key = '1.2.3.4:a@b.com';
    for (let i = 0; i < 4; i++) {
      await limiter.recordFailure(key);
      expect(await limiter.isBlocked(key)).toBe(false);
    }
    await limiter.recordFailure(key);
    expect(await limiter.isBlocked(key)).toBe(true);
  });

  it('keys attempts independently per ip+email', async () => {
    const key = '1.2.3.4:a@b.com';
    await fail(key, 5);
    expect(await limiter.isBlocked(key)).toBe(true);
    expect(await limiter.isBlocked('5.6.7.8:a@b.com')).toBe(false);
    expect(await limiter.isBlocked('1.2.3.4:c@d.com')).toBe(false);
  });

  it('accepts a different maximum for a looser limit', async () => {
    await fail('k', 5);
    expect(await limiter.isBlocked('k')).toBe(true);
    expect(await limiter.isBlocked('k', 20)).toBe(false);
  });

  it('reset clears the block', async () => {
    const key = '1.2.3.4:a@b.com';
    await fail(key, 5);
    expect(await limiter.isBlocked(key)).toBe(true);
    await limiter.reset(key);
    expect(await limiter.isBlocked(key)).toBe(false);
  });

  it('expires the window after 15 minutes', async () => {
    const key = '1.2.3.4:a@b.com';
    await fail(key, 5);
    expect(await limiter.isBlocked(key)).toBe(true);
    now += 15 * 60 * 1000 + 1;
    expect(await limiter.isBlocked(key)).toBe(false);
  });

  it('does not block, and does not throw, when the store is down', async () => {
    const down = () => Promise.reject(new Error('db down'));
    const broken = new LoginRateLimiter({ hit: down, count: down, reset: down } as RateLimitStore);
    await expect(broken.recordFailure('k')).resolves.toBeUndefined();
    await expect(broken.reset('k')).resolves.toBeUndefined();
    expect(await broken.isBlocked('k')).toBe(false);
  });
});
