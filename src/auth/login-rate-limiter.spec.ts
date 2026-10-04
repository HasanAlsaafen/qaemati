import { LoginRateLimiter } from './login-rate-limiter';

describe('LoginRateLimiter', () => {
  let limiter: LoginRateLimiter;

  beforeEach(() => {
    limiter = new LoginRateLimiter();
  });

  it('is not blocked before any failures', () => {
    expect(limiter.isBlocked('1.2.3.4:a@b.com')).toBe(false);
  });

  it('blocks after 5 failures within the window', () => {
    const key = '1.2.3.4:a@b.com';
    for (let i = 0; i < 4; i++) {
      limiter.recordFailure(key);
      expect(limiter.isBlocked(key)).toBe(false);
    }
    limiter.recordFailure(key);
    expect(limiter.isBlocked(key)).toBe(true);
  });

  it('keys attempts independently per ip+email', () => {
    const key = '1.2.3.4:a@b.com';
    for (let i = 0; i < 5; i++) limiter.recordFailure(key);
    expect(limiter.isBlocked(key)).toBe(true);
    expect(limiter.isBlocked('5.6.7.8:a@b.com')).toBe(false);
    expect(limiter.isBlocked('1.2.3.4:c@d.com')).toBe(false);
  });

  it('reset clears the block', () => {
    const key = '1.2.3.4:a@b.com';
    for (let i = 0; i < 5; i++) limiter.recordFailure(key);
    expect(limiter.isBlocked(key)).toBe(true);
    limiter.reset(key);
    expect(limiter.isBlocked(key)).toBe(false);
  });

  it('expires the window after 15 minutes', () => {
    const key = '1.2.3.4:a@b.com';
    const realNow = Date.now;
    let now = realNow();
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    for (let i = 0; i < 5; i++) limiter.recordFailure(key);
    expect(limiter.isBlocked(key)).toBe(true);

    now += 15 * 60 * 1000 + 1;
    expect(limiter.isBlocked(key)).toBe(false);

    jest.spyOn(Date, 'now').mockRestore();
  });
});
