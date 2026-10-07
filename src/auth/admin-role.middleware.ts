import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { canOpen, homeFor, parseRole } from '../pos/roles';

/**
 * A cashier or kitchen account only gets the orders screen. Everything else
 * under /admin is refused by default, so a page added later is for owners
 * unless someone deliberately opens it to staff. A session from before roles
 * existed has no role and was always an owner.
 */
@Injectable()
export class AdminRoleMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const role = parseRole(req.session.adminRole) ?? 'OWNER';
    if (canOpen(role, req.originalUrl)) return next();
    const wantsPage = req.method === 'GET' && req.headers['hx-request'] !== 'true';
    if (wantsPage) return res.redirect(homeFor(role));
    throw new ForbiddenException('Your account cannot do this');
  }
}
