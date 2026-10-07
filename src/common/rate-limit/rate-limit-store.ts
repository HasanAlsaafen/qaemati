/**
 * Counters for fixed window rate limits. The window starts at the first hit
 * and the count disappears when it ends.
 */
export interface RateLimitStore {
  /** Adds one to the key and returns the new count in the current window. */
  hit(key: string, windowMs: number): Promise<number>;
  /** The count in the current window, 0 when there is none. */
  count(key: string): Promise<number>;
  reset(key: string): Promise<void>;
}

export const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');

interface Bucket {
  count: number;
  resetAt: number;
}

/** One process only. Used by tests and as the fallback when there is no database. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = Date.now) {}

  async hit(key: string, windowMs: number): Promise<number> {
    const time = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= time) {
      bucket = { count: 0, resetAt: time + windowMs };
      this.buckets.set(key, bucket);
      if (this.buckets.size > 5000) {
        for (const [k, b] of this.buckets) if (b.resetAt <= time) this.buckets.delete(k);
      }
    }
    bucket.count += 1;
    return bucket.count;
  }

  async count(key: string): Promise<number> {
    const bucket = this.buckets.get(key);
    return bucket && bucket.resetAt > this.now() ? bucket.count : 0;
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}
