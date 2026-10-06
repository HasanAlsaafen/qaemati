import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PlanFeature } from './plan-features';
import { FeatureUnavailableException } from './tenancy.exceptions';
import { TenancyService } from './tenancy.service';

const KEY = 'requiredFeature';

/** Put on a controller or handler: the route only works when the plan has it. */
export const RequiresFeature = (feature: PlanFeature) => SetMetadata(KEY, feature);

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenancy: TenancyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PlanFeature | undefined>(KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const restaurantId = request.session?.restaurantId;
    if (!restaurantId) return true;
    if (!(await this.tenancy.hasFeature(restaurantId, feature))) {
      throw new FeatureUnavailableException(feature);
    }
    return true;
  }
}
