import { NextFunction, Request, Response } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Which requests count. Defaults to every request that reaches it. */
  match?: (req: Request) => boolean;
  now?: () => number;
}

/**
 * Fixed-window limiter keyed by client IP. In memory, so it is per
 * process: with several instances behind a balancer each keeps its own
 * counts and the effective limit is max times instance count. Swap the
 * Map for a shared store when that matters (see docs/conversion-roadmap.md).
 */
export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const now = options.now ?? Date.now;

  return function rateLimit(req: Request, _res: Response, next: NextFunction): void {
    if (options.match && !options.match(req)) return next();

    const time = now();
    const key = req.ip ?? 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= time) {
      bucket = { count: 0, resetAt: time + options.windowMs };
      buckets.set(key, bucket);
      // Drop expired buckets opportunistically so the map cannot grow forever.
      if (buckets.size > 5000) {
        for (const [k, b] of buckets) if (b.resetAt <= time) buckets.delete(k);
      }
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      // Shaped like an http-errors error so the global exception filter
      // renders it as a 429 (same path CSRF rejections take).
      return next(Object.assign(new Error('Too many requests'), { statusCode: 429 }));
    }
    next();
  };
}
