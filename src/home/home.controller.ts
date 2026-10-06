import { Controller, Get, Query, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { isDemoModeEnabled } from '../common/demo-mode';
import { getBaseUrl } from '../seo/seo';
import { DEMO_ADMIN_PASSWORD } from '../prisma-seed/run-seed';

@Controller()
export class HomeController {
  constructor(private readonly prisma: PrismaService) {}

  /** B4: the service worker's offline fallback (public/sw.js) serves
   *  this page -- precached at install time -- for any navigation that
   *  fails while offline and isn't otherwise cached. Plain GET, no
   *  restaurant context: by the time this renders, the actual page the
   *  visitor wanted has already failed to load. */
  @Get('offline')
  @Render('pages/offline')
  offline() {
    return {};
  }

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
      seo: { canonicalUrl: `${getBaseUrl(req)}/` },
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
