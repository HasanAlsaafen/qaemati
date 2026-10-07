import { Injectable } from '@nestjs/common';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface Attempt {
  count: number;
  firstAttemptAt: number;
}

/**
 * In-memory login rate limiter, keyed by "ip:email". Good enough for a
 * single-process demo; a real deployment behind multiple instances would
 * need this backed by Redis or the database instead, since in-memory state
 * isn't shared across processes.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly attempts = new Map<string, Attempt>();

  isBlocked(key: string, max = MAX_ATTEMPTS): boolean {
    const attempt = this.attempts.get(key);
    if (!attempt) return false;

    if (Date.now() - attempt.firstAttemptAt > WINDOW_MS) {
      this.attempts.delete(key);
      return false;
    }

    return attempt.count >= max;
  }

  recordFailure(key: string): void {
    const attempt = this.attempts.get(key);
    if (!attempt || Date.now() - attempt.firstAttemptAt > WINDOW_MS) {
      this.attempts.set(key, { count: 1, firstAttemptAt: Date.now() });
      return;
    }
    attempt.count += 1;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
