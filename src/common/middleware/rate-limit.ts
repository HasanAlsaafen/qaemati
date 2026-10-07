import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RateLimitStore } from '../rate-limit/rate-limit-store';

export interface RateLimitOptions {
  /** Separates this limit's counters from the others sharing the store. */
  name: string;
  windowMs: number;
  max: number;
  /** Which requests count. Defaults to every request that reaches it. */
  match?: (req: Request) => boolean;
}

const logger = new Logger('RateLimit');

/**
 * Fixed window limiter keyed by client IP, counted in the shared store. If
 * the store is unreachable the request goes through: the database being down
 * already stops anything that matters, and a limiter must not be the thing
 * that takes the site down.
 */
export function createRateLimiter(store: RateLimitStore, options: RateLimitOptions) {
  return async function rateLimit(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (options.match && !options.match(req)) return next();

    let count: number;
    try {
      count = await store.hit(`${options.name}:${req.ip ?? 'unknown'}`, options.windowMs);
    } catch (error) {
      logger.error(`Counting failed, letting the request through: ${error}`);
      return next();
    }
    if (count > options.max) {
      // Shaped like an http-errors error so the global exception filter
      // renders it as a 429 (same path CSRF rejections take).
      return next(Object.assign(new Error('Too many requests'), { statusCode: 429 }));
    }
    next();
  };
}
