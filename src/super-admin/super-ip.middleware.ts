import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { isAllowedIp } from './ip-allowlist';
import { allowedIps } from './security-policy';

/**
 * With SUPER_ALLOWED_IPS set, the platform area does not exist for anyone else:
 * the answer is a plain 404, not a refusal that confirms the page is there.
 */
@Injectable()
export class SuperIpMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (!isAllowedIp(req.ip, allowedIps())) throw new NotFoundException();
    next();
  }
}
