import { Injectable } from '@nestjs/common';
import { Plan, Prisma, Restaurant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { addDays } from '../tenancy/billing-dates';

/** Paths that already mean something, so a restaurant cannot take them. */
export const RESERVED_SLUGS = new Set([
  'admin',
  'super',
  'm',
  'lang',
  'demo',
  'health',
  'robots',
  'sitemap',
  'styleguide',
  'offline',
  'uploads',
  'images',
  'css',
  'js',
  'fonts',
  'api',
  'static',
  'assets',
]);

/** A restaurant address or an owner email is already taken. */
export class ProvisionConflict extends Error {
  constructor(readonly field: 'slug' | 'email') {
    super(`${field} is taken`);
  }
}

export type StartMode = { mode: 'TRIAL' } | { mode: 'ACTIVE'; paidUntil: Date };

export interface ProvisionInput {
  slug: string;
  nameAr: string;
  nameEn: string;
  plan: Plan;
  start: StartMode;
  owner: { name: string; email: string; passwordHash: string };
}

/**
 * Creates a restaurant the way every route does: the restaurant, its first
 * menu, its subscription and its first owner, all or nothing. Used by the
 * platform area and by self sign up, so the two can never drift apart.
 */
@Injectable()
export class TenantProvisioner {
  constructor(private readonly prisma: PrismaService) {}

  isReserved(slug: string): boolean {
    return RESERVED_SLUGS.has(slug);
  }

  async provision(input: ProvisionInput): Promise<Restaurant> {
    const now = new Date();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.restaurant.create({
          data: {
            slug: input.slug,
            nameAr: input.nameAr.trim(),
            nameEn: input.nameEn.trim(),
            currency: input.plan.currency,
          },
        });
        await tx.menu.create({
          data: {
            restaurantId: created.id,
            nameAr: 'القائمة الرئيسية',
            nameEn: 'Main menu',
            sortOrder: 0,
          },
        });
        await tx.subscription.create({
          data:
            input.start.mode === 'TRIAL'
              ? {
                  restaurantId: created.id,
                  planId: input.plan.id,
                  status: 'TRIALING',
                  trialEndsAt: addDays(now, input.plan.trialDays),
                }
              : {
                  restaurantId: created.id,
                  planId: input.plan.id,
                  status: 'ACTIVE',
                  currentPeriodStart: now,
                  currentPeriodEnd: input.start.paidUntil,
                },
        });
        await tx.adminUser.create({
          data: {
            restaurantId: created.id,
            email: input.owner.email.trim().toLowerCase(),
            name: input.owner.name.trim(),
            passwordHash: input.owner.passwordHash,
            role: 'OWNER',
          },
        });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ProvisionConflict(
          String(error.meta?.target ?? '').includes('email') ? 'email' : 'slug',
        );
      }
      throw error;
    }
  }
}
