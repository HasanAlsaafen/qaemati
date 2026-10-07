import { Inject, Injectable, Logger } from '@nestjs/common';
import { RATE_LIMIT_STORE, RateLimitStore } from '../common/rate-limit/rate-limit-store';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Failure counter keyed by something like "ip:email", kept in the shared
 * rate limit store so it survives restarts and applies across instances. If
 * the store cannot be reached it does not block: a sign in needs the same
 * database and fails on its own then.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly logger = new Logger(LoginRateLimiter.name);

  constructor(@Inject(RATE_LIMIT_STORE) private readonly store: RateLimitStore) {}

  async isBlocked(key: string, max = MAX_ATTEMPTS): Promise<boolean> {
    try {
      return (await this.store.count(`login:${key}`)) >= max;
    } catch (error) {
      this.logger.error(`Reading a limit failed: ${error}`);
      return false;
    }
  }

  async recordFailure(key: string): Promise<void> {
    try {
      await this.store.hit(`login:${key}`, WINDOW_MS);
    } catch (error) {
      this.logger.error(`Recording a failure failed: ${error}`);
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.store.reset(`login:${key}`);
    } catch (error) {
      this.logger.error(`Clearing a limit failed: ${error}`);
    }
  }
}
