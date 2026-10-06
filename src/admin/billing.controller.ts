import { Controller, Get, NotFoundException, Param, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { LIMIT_RESOURCES, LimitResource, PLAN_FEATURES } from '../tenancy/plan-features';

/** The owner's read only view of their own subscription and receipts. */
@Controller('admin/billing')
export class BillingController {
  constructor(
    private readonly tenancy: TenancyService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Render('admin/billing')
  async index(@Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    const context = await this.tenancy.getContext(restaurantId);
    const usage = await this.tenancy.usage(restaurantId);
    const payments = await this.prisma.payment.findMany({
      where: { restaurantId },
      orderBy: { paidAt: 'desc' },
      take: 50,
    });
    return {
      subscription: context.subscription,
      plan: context.plan,
      access: context.access,
      payments,
      allFeatures: PLAN_FEATURES,
      enabledFeatures: [...context.features],
      resources: (Object.keys(LIMIT_RESOURCES) as LimitResource[]).map((resource) => ({
        resource,
        used: usage[resource],
        limit: this.tenancy.limitFor(context.plan, resource),
      })),
    };
  }

  @Get('receipts/:id')
  @Render('receipts/receipt')
  async receipt(@Param('id') id: string, @Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    const payment = await this.prisma.payment.findFirst({
      where: { id, restaurantId },
      include: { restaurant: true, subscription: { include: { plan: true } } },
    });
    if (!payment) throw new NotFoundException('Receipt not found');
    return { payment, layout: 'tenant' };
  }
}
