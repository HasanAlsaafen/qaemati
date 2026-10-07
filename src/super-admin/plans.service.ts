import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isPlanFeature } from '../tenancy/plan-features';
import { Actor, AuditService } from './audit.service';
import { PlanDto } from './dto/super.dto';

const toLimit = (value: string | undefined): number | null =>
  value === undefined || value === '' ? null : Number(value);

function toData(dto: PlanDto) {
  return {
    nameAr: dto.nameAr.trim(),
    nameEn: dto.nameEn.trim(),
    descriptionAr: dto.descriptionAr?.trim() || null,
    descriptionEn: dto.descriptionEn?.trim() || null,
    priceAmount: dto.priceAmount,
    currency: dto.currency,
    interval: dto.interval,
    trialDays: dto.trialDays ? Number(dto.trialDays) : 0,
    maxMenus: toLimit(dto.maxMenus),
    maxCategories: toLimit(dto.maxCategories),
    maxItems: toLimit(dto.maxItems),
    maxAdminUsers: toLimit(dto.maxAdminUsers),
    features: (dto.features ?? []).filter(isPlanFeature),
  };
}

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.plan.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { priceAmount: 'asc' }],
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  /** Plans a new tenant can be put on. */
  listChoosable() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceAmount: 'asc' }],
    });
  }

  async get(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(actor: Actor, dto: PlanDto) {
    const plan = await this.prisma.plan.create({ data: toData(dto) });
    await this.audit.log(actor, 'plan.created', null, { planId: plan.id, name: plan.nameEn });
    return plan;
  }

  async update(actor: Actor, id: string, dto: PlanDto) {
    await this.get(id);
    const plan = await this.prisma.plan.update({ where: { id }, data: toData(dto) });
    await this.audit.log(actor, 'plan.updated', null, { planId: id, name: plan.nameEn });
    return plan;
  }

  /** Archived plans stay on the tenants that already have them. */
  async setActive(actor: Actor, id: string, isActive: boolean) {
    await this.get(id);
    await this.prisma.plan.update({ where: { id }, data: { isActive } });
    await this.audit.log(actor, isActive ? 'plan.restored' : 'plan.archived', null, { planId: id });
  }
}
