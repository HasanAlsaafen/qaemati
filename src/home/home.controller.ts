import { Controller, Get, Query, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { isDemoModeEnabled } from '../common/demo-mode';
import { thmanyahEnabled } from '../common/thmanyah';
import { getBaseUrl, serializeJsonLd } from '../seo/seo';
import { landingContact, toLandingPlans } from './landing';
import { DEMO_ADMIN_PASSWORD, DEMO_SUPER_ADMIN_EMAIL } from '../prisma-seed/run-seed';

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
    const locale = req.locale === 'en' ? 'en' : 'ar';
    const demoMode = isDemoModeEnabled();
    const baseUrl = getBaseUrl(req);

    // Other customers' restaurants are listed only on a demo site. A real
    // deployment never advertises who its customers are.
    const restaurants = demoMode
      ? await this.prisma.restaurant.findMany({
          select: {
            slug: true,
            nameAr: true,
            nameEn: true,
            adminUsers: { select: { email: true }, take: 1 },
          },
          orderBy: { nameEn: 'asc' },
        })
      : [];
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceAmount: 'asc' }],
    });
    const landingPlans = toLandingPlans(plans, locale);
    const contact = landingContact();
    const demoSlug = process.env.LANDING_DEMO_SLUG?.trim() || restaurants[0]?.slug || null;

    return {
      seo: {
        canonicalUrl: `${baseUrl}/`,
        jsonLd: serializeJsonLd({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Qaemati',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          url: `${baseUrl}/`,
          inLanguage: ['ar', 'en'],
          offers: plans.map((plan) => ({
            '@type': 'Offer',
            name: plan.nameEn,
            price: Number(plan.priceAmount).toFixed(2),
            priceCurrency: plan.currency,
          })),
        }),
      },
      thmanyah: thmanyahEnabled(),
      plans: landingPlans,
      hasTrial: landingPlans.some((plan) => plan.trialDays > 0),
      contact,
      demoSlug,
      year: new Date().getFullYear(),
      restaurants: restaurants.map((restaurant) => ({
        slug: restaurant.slug,
        name: locale === 'ar' ? restaurant.nameAr : restaurant.nameEn,
        demoAdminEmail: restaurant.adminUsers?.[0]?.email ?? null,
      })),
      demoMode,
      demoAdminPassword: demoMode ? DEMO_ADMIN_PASSWORD : null,
      demoSuperAdminEmail: demoMode ? DEMO_SUPER_ADMIN_EMAIL : null,
      demoResetSucceeded: demoReset === 'success',
    };
  }
}
