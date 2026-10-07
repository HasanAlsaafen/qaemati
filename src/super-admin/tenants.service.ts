import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { AccessState, computeAccess } from '../tenancy/tenant-access';
import { ProvisionConflict, TenantProvisioner } from '../provisioning/tenant-provisioner.service';
import { Actor, AuditService } from './audit.service';
import {
  ChangePlanDto,
  CreateTenantDto,
  SubscriptionSettingsDto,
  SubscriptionStatusDto,
  TenantAdminDto,
} from './dto/super.dto';
import { FieldError } from './field-error';
import { generatePassword } from './password';

/** A date picked in a form means the end of that day, UTC. */
export function endOfDay(date: string): Date {
  return new Date(`${date}T23:59:59.000Z`);
}

export interface TenantRow {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  createdAt: Date;
  planName: { ar: string; en: string } | null;
  status: string | null;
  state: AccessState;
  endsAt: Date | null;
  daysLeft: number | null;
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
    private readonly provisioner: TenantProvisioner,
  ) {}

  async list(filter: { q?: string; state?: string } = {}): Promise<TenantRow[]> {
    const q = filter.q?.trim();
    const restaurants = await this.prisma.restaurant.findMany({
      where: q
        ? {
            OR: [
              { slug: { contains: q, mode: 'insensitive' } },
              { nameEn: { contains: q, mode: 'insensitive' } },
              { nameAr: { contains: q } },
            ],
          }
        : {},
      include: { subscription: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    const rows = restaurants.map((r) => {
      const access = computeAccess(r.subscription, now);
      return {
        id: r.id,
        slug: r.slug,
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        createdAt: r.createdAt,
        planName: r.subscription
          ? { ar: r.subscription.plan.nameAr, en: r.subscription.plan.nameEn }
          : null,
        status: r.subscription?.status ?? null,
        state: access.state,
        endsAt: access.endsAt,
        daysLeft: access.daysLeft,
      };
    });
    return filter.state ? rows.filter((row) => row.state === filter.state) : rows;
  }

  async detail(id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        adminUsers: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' }, take: 20 },
      },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    const context = await this.tenancy.getContext(id);
    return {
      restaurant,
      subscription: restaurant.subscription,
      plan: restaurant.subscription?.plan ?? null,
      access: context.access,
      usage: await this.tenancy.usage(id),
      limits: {
        menus: this.tenancy.limitFor(context.plan, 'menus'),
        categories: this.tenancy.limitFor(context.plan, 'categories'),
        items: this.tenancy.limitFor(context.plan, 'items'),
        adminUsers: this.tenancy.limitFor(context.plan, 'adminUsers'),
      },
      audit: await this.audit.list({ restaurantId: id, take: 15 }),
      notices: await this.prisma.notificationLog.findMany({
        where: { restaurantId: id },
        orderBy: { sentAt: 'desc' },
        take: 10,
      }),
    };
  }

  /** Creates the restaurant, its first menu, its subscription and its first admin. */
  async create(actor: Actor, dto: CreateTenantDto) {
    const slug = dto.slug.trim();
    if (this.provisioner.isReserved(slug)) throw new FieldError('slug', 'slugReserved');
    const plan = await this.prisma.plan.findFirst({ where: { id: dto.planId, isActive: true } });
    if (!plan) throw new FieldError('planId', 'planUnavailable');
    if (dto.startMode === 'ACTIVE' && !dto.paidUntil)
      throw new FieldError('paidUntil', 'paidUntilRequired');

    const password = generatePassword();
    try {
      const restaurant = await this.provisioner.provision({
        slug,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        plan,
        start:
          dto.startMode === 'TRIAL'
            ? { mode: 'TRIAL' }
            : { mode: 'ACTIVE', paidUntil: endOfDay(dto.paidUntil!) },
        owner: {
          name: dto.adminName,
          email: dto.adminEmail,
          passwordHash: await bcrypt.hash(password, 10),
        },
      });
      await this.audit.log(actor, 'tenant.created', restaurant.id, {
        slug,
        plan: plan.nameEn,
        startMode: dto.startMode,
      });
      return { restaurant, password };
    } catch (error) {
      if (error instanceof ProvisionConflict) {
        throw new FieldError(
          error.field === 'email' ? 'adminEmail' : 'slug',
          error.field === 'email' ? 'emailTaken' : 'slugTaken',
        );
      }
      throw error;
    }
  }

  async changePlan(actor: Actor, restaurantId: string, dto: ChangePlanDto) {
    const subscription = await this.requireSubscription(restaurantId);
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    // An archived plan can stay where it is but cannot be newly assigned.
    if (!plan || (!plan.isActive && plan.id !== subscription.planId))
      throw new FieldError('planId', 'planUnavailable');
    await this.prisma.subscription.update({ where: { restaurantId }, data: { planId: plan.id } });
    await this.audit.log(actor, 'subscription.plan_changed', restaurantId, {
      from: subscription.planId,
      to: plan.id,
    });
  }

  async changeStatus(actor: Actor, restaurantId: string, dto: SubscriptionStatusDto) {
    const subscription = await this.requireSubscription(restaurantId);
    const now = new Date();
    if (dto.action === 'suspend') {
      await this.prisma.subscription.update({
        where: { restaurantId },
        data: { status: 'SUSPENDED', suspendedReason: dto.reason?.trim() || null },
      });
    } else if (dto.action === 'cancel') {
      await this.prisma.subscription.update({
        where: { restaurantId },
        data: { status: 'CANCELED', canceledAt: now, suspendedReason: dto.reason?.trim() || null },
      });
    } else {
      // Back to the state the dates describe: a trial that has not ended is
      // still a trial, everything else is a paid subscription.
      const isTrial =
        subscription.currentPeriodEnd === null &&
        subscription.trialEndsAt !== null &&
        subscription.trialEndsAt > now;
      await this.prisma.subscription.update({
        where: { restaurantId },
        data: { status: isTrial ? 'TRIALING' : 'ACTIVE', suspendedReason: null, canceledAt: null },
      });
    }
    await this.audit.log(actor, `subscription.${dto.action}`, restaurantId, {
      reason: dto.reason ?? null,
    });
  }

  async updateSettings(actor: Actor, restaurantId: string, dto: SubscriptionSettingsDto) {
    await this.requireSubscription(restaurantId);
    await this.prisma.subscription.update({
      where: { restaurantId },
      data: {
        graceDays: Number(dto.graceDays),
        trialEndsAt: dto.trialEndsAt ? endOfDay(dto.trialEndsAt) : null,
        currentPeriodEnd: dto.currentPeriodEnd ? endOfDay(dto.currentPeriodEnd) : null,
        note: dto.note?.trim() || null,
      },
    });
    await this.audit.log(actor, 'subscription.settings_changed', restaurantId, {
      graceDays: dto.graceDays,
      trialEndsAt: dto.trialEndsAt || null,
      currentPeriodEnd: dto.currentPeriodEnd || null,
    });
  }

  async addAdmin(actor: Actor, restaurantId: string, dto: TenantAdminDto) {
    await this.requireRestaurant(restaurantId);
    await this.tenancy.assertCanAdd(restaurantId, 'adminUsers');
    const password = generatePassword();
    try {
      await this.prisma.adminUser.create({
        data: {
          restaurantId,
          email: dto.email.trim().toLowerCase(),
          name: dto.name.trim(),
          passwordHash: await bcrypt.hash(password, 10),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new FieldError('email', 'emailTaken');
      }
      throw error;
    }
    await this.audit.log(actor, 'admin.created', restaurantId, {
      email: dto.email.trim().toLowerCase(),
    });
    return password;
  }

  async resetAdminPassword(actor: Actor, restaurantId: string, adminId: string) {
    const admin = await this.prisma.adminUser.findFirst({ where: { id: adminId, restaurantId } });
    if (!admin) throw new NotFoundException('Admin not found');
    const password = generatePassword();
    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    await this.audit.log(actor, 'admin.password_reset', restaurantId, { email: admin.email });
    return { email: admin.email, password };
  }

  async removeAdmin(actor: Actor, restaurantId: string, adminId: string) {
    const admins = await this.prisma.adminUser.findMany({ where: { restaurantId } });
    const admin = admins.find((a) => a.id === adminId);
    if (!admin) throw new NotFoundException('Admin not found');
    if (admins.length <= 1) throw new FieldError('admin', 'lastAdmin');
    await this.prisma.adminUser.delete({ where: { id: adminId } });
    await this.audit.log(actor, 'admin.removed', restaurantId, { email: admin.email });
  }

  private async requireRestaurant(id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  private async requireSubscription(restaurantId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { restaurantId } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return subscription;
  }
}
