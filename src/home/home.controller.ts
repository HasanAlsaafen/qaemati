import { Controller, Get, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { isDemoModeEnabled } from '../common/demo-mode';
import { thmanyahEnabled } from '../common/thmanyah';
import { getBaseUrl, serializeJsonLd } from '../seo/seo';
import { SignupService } from '../signup/signup.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { isServable } from '../tenancy/tenant-access';
import { landingContact, toLandingPlans } from './landing';

@Controller()
export class HomeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly signup: SignupService,
  ) {}

  /** A menu the landing page can show live: it exists, and it is not switched off. */
  private async liveDemoSlug(candidates: (string | undefined)[]): Promise<string | null> {
    for (const slug of candidates) {
      if (!slug) continue;
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { slug },
        select: { id: true, menus: { select: { id: true }, take: 1 } },
      });
      if (!restaurant || restaurant.menus.length === 0) continue;
      if (isServable((await this.tenancy.getContext(restaurant.id)).access)) return slug;
    }
    return null;
  }

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

  /** On a demo site the sample restaurants, so the phone has a menu to show. */
  private async demoSlugs(): Promise<string[]> {
    const rows = await this.prisma.restaurant.findMany({
      select: { slug: true },
      orderBy: { nameEn: 'asc' },
    });
    return rows.map((row) => row.slug);
  }

  /**
   * What the "try it" tour needs, on a demo site only: the two sample menus (two
   * looks), a free table to order from and nothing about logins: the landing page never lists them.
   */
  private async tour(slugs: string[], demoSlug: string) {
    const live: string[] = [];
    for (const slug of [demoSlug, ...slugs]) {
      if (!live.includes(slug) && (await this.liveDemoSlug([slug]))) live.push(slug);
    }
    const table = await this.prisma.restaurantTable.findFirst({
      where: { restaurant: { slug: demoSlug } },
      orderBy: { sortOrder: 'desc' },
      select: { token: true, label: true },
    });
    return {
      slugs: live.slice(0, 2),
      table,
    };
  }

  @Get()
  @Render('pages/home')
  async index(@Req() req: Request) {
    const locale = req.locale === 'en' ? 'en' : 'ar';
    const demoMode = isDemoModeEnabled();
    const baseUrl = getBaseUrl(req);

    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceAmount: 'asc' }],
    });
    const landingPlans = toLandingPlans(plans, locale);
    const contact = landingContact();
    const demoSlugList = demoMode ? await this.demoSlugs() : [];
    const demoSlug = await this.liveDemoSlug([
      process.env.LANDING_DEMO_SLUG?.trim(),
      ...demoSlugList,
    ]);

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
      signupAvailable: await this.signup.available(),
      thmanyah: thmanyahEnabled(),
      plans: landingPlans,
      hasTrial: landingPlans.some((plan) => plan.trialDays > 0),
      contact,
      demoSlug,
      tour: demoMode && demoSlug ? await this.tour(demoSlugList, demoSlug) : null,
      year: new Date().getFullYear(),
    };
  }
}
