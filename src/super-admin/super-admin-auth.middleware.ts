import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { requireTwoFactor } from './security-policy';

/** Guards every /super route except sign in and password reset. */
@Injectable()
export class SuperAdminAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (!req.session.superAdminId) {
      res.redirect('/super/login');
      return;
    }
    res.locals.superAdminName = req.session.superAdminName;
    const path = req.originalUrl.split('?')[0];
    const allowedWithoutTwoFactor = path.startsWith('/super/security') || path === '/super/logout';
    if (requireTwoFactor() && !req.session.superTwoFactor && !allowedWithoutTwoFactor) {
      res.redirect('/super/security');
      return;
    }
    next();
  }
}
