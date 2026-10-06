import { HttpException, HttpStatus } from '@nestjs/common';
import { LimitResource, PlanFeature } from './plan-features';

/** The restaurant's subscription is over, so its admin is read only. */
export class SubscriptionBlockedException extends HttpException {
  constructor(readonly reason: string | null) {
    super('Subscription is not active', HttpStatus.PAYMENT_REQUIRED);
  }
}

/** The plan's cap for this resource is reached. */
export class PlanLimitException extends HttpException {
  constructor(
    readonly resource: LimitResource,
    readonly limit: number,
  ) {
    super(`Plan limit reached for ${resource}`, HttpStatus.PAYMENT_REQUIRED);
  }
}

/** The plan does not include this feature. */
export class FeatureUnavailableException extends HttpException {
  constructor(readonly feature: PlanFeature) {
    super(`Feature ${feature} is not part of the plan`, HttpStatus.PAYMENT_REQUIRED);
  }
}

/** The public menu of a restaurant whose subscription is over. */
export class MenuUnavailableException extends HttpException {
  constructor() {
    super('Menu is unavailable', HttpStatus.SERVICE_UNAVAILABLE);
  }
}
