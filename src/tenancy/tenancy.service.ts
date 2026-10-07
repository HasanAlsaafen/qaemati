import { Injectable } from '@nestjs/common';
import { Plan, Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LIMIT_RESOURCES, LimitResource, PlanFeature, isPlanFeature } from './plan-features';
import { PlanLimitException } from './tenancy.exceptions';
import { TenantAccess, computeAccess } from './tenant-access';

export interface TenantContext {
  subscription: Subscription | null;
  plan: Plan | null;
  access: TenantAccess;
  features: Set<PlanFeature>;
}

export type Usage = Record<LimitResource, number>;

/**
 * Everything the app needs to know about what a restaurant has paid for.
 * Restaurants with no subscription row (created before billing) count as
 * unlimited, see computeAccess.
 */
@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  async getContext(restaurantId: string, now = new Date()): Promise<TenantContext> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { restaurantId },
      include: { plan: true },
    });
    const plan = subscription?.plan ?? null;
    return {
      subscription: subscription ?? null,
      plan,
      access: computeAccess(subscription, now),
      // No plan means the legacy, unlimited behavior: every feature on.
      features: new Set(
        plan
          ? plan.features.filter(isPlanFeature)
          : (['bulkTools', 'analytics', 'whatsappOrdering', 'tableOrdering'] as PlanFeature[]),
      ),
    };
  }

  async usage(restaurantId: string): Promise<Usage> {
    const [menus, categories, items, adminUsers] = await Promise.all([
      this.prisma.menu.count({ where: { restaurantId } }),
      this.prisma.category.count({ where: { restaurantId } }),
      this.prisma.item.count({ where: { restaurantId } }),
      this.prisma.adminUser.count({ where: { restaurantId } }),
    ]);
    return { menus, categories, items, adminUsers };
  }

  limitFor(plan: Plan | null, resource: LimitResource): number | null {
    return plan ? plan[LIMIT_RESOURCES[resource]] : null;
  }

  /** Throws PlanLimitException when adding `adding` more would pass the cap. */
  async assertCanAdd(restaurantId: string, resource: LimitResource, adding = 1): Promise<void> {
    const { plan } = await this.getContext(restaurantId);
    const limit = this.limitFor(plan, resource);
    if (limit === null) return;
    const used = (await this.usage(restaurantId))[resource];
    if (used + adding > limit) throw new PlanLimitException(resource, limit);
  }

  async hasFeature(restaurantId: string, feature: PlanFeature): Promise<boolean> {
    return (await this.getContext(restaurantId)).features.has(feature);
  }
}
