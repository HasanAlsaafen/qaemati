import { Controller, Get, Query, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { isDemoModeEnabled } from '../common/demo-mode';
import { DEMO_ADMIN_PASSWORD } from '../prisma-seed/run-seed';

@Controller()
export class HomeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('pages/home')
  async index(@Query('demoReset') demoReset: string | undefined, @Req() req: Request) {
    const locale = req.locale ?? 'ar';
    const demoMode = isDemoModeEnabled();
    const restaurants = await this.prisma.restaurant.findMany({
      select: {
        slug: true,
        nameAr: true,
        nameEn: true,
        adminUsers: demoMode ? { select: { email: true }, take: 1 } : false,
      },
      orderBy: { nameEn: 'asc' },
    });

    return {
      restaurants: restaurants.map((restaurant) => ({
        slug: restaurant.slug,
        name: locale === 'ar' ? restaurant.nameAr : restaurant.nameEn,
        demoAdminEmail: restaurant.adminUsers?.[0]?.email ?? null,
      })),
      demoMode,
      demoAdminPassword: demoMode ? DEMO_ADMIN_PASSWORD : null,
      demoResetSucceeded: demoReset === 'success',
    };
  }
}
