import { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';

const logger = new Logger('Http');
const STATIC_PREFIXES = ['/css/', '/js/', '/fonts/', '/uploads/'];

/** Logs method, path, status and duration once the response finishes. */
export function accessLog(req: Request, res: Response, next: NextFunction): void {
  if (STATIC_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return next();
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    logger.log(`${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
}
