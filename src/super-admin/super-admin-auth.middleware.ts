import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/** Guards every /super route except the login page. */
@Injectable()
export class SuperAdminAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (req.session.superAdminId) {
      res.locals.superAdminName = req.session.superAdminName;
      next();
      return;
    }
    res.redirect('/super/login');
  }
}
