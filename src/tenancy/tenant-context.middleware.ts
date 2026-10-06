import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LimitResource } from './plan-features';
import { SubscriptionBlockedException } from './tenancy.exceptions';
import { TenancyService } from './tenancy.service';

const ALWAYS_ALLOWED_WRITES = new Set(['/admin/logout']);

/**
 * Runs for every signed in admin request. Puts the restaurant's plan, access
 * state and usage on the template locals, so the sidebar can hide features and
 * the banner can warn, and refuses writes once the subscription is over. Reads
 * stay allowed, so an owner can still see their data and the billing page.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenancy: TenancyService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const restaurantId = req.session.restaurantId;
    if (!restaurantId) return next();
    try {
      const context = await this.tenancy.getContext(restaurantId);
      const usage = await this.tenancy.usage(restaurantId);
      res.locals.tenant = {
        access: context.access,
        plan: context.plan,
        subscription: context.subscription,
        features: [...context.features],
        usage,
        limits: Object.fromEntries(
          (['menus', 'categories', 'items', 'adminUsers'] as LimitResource[]).map((r) => [
            r,
            this.tenancy.limitFor(context.plan, r),
          ]),
        ),
      };
      const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
      if (
        isWrite &&
        context.access.state === 'blocked' &&
        !ALWAYS_ALLOWED_WRITES.has(req.originalUrl.split('?')[0])
      ) {
        return next(new SubscriptionBlockedException(context.access.reason));
      }
      next();
    } catch (error) {
      next(error);
    }
  }
}
