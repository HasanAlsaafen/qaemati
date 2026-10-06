import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { getBaseUrl } from './seo';
import { computeAccess, isServable } from '../tenancy/tenant-access';

@Controller()
export class SeoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  robots(@Req() req: Request): string {
    return [
      'User-agent: *',
      'Disallow: /admin',
      'Disallow: /styleguide',
      'Disallow: /health',
      `Sitemap: ${getBaseUrl(req)}/sitemap.xml`,
      '',
    ].join('\n');
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async sitemap(@Req() req: Request): Promise<string> {
    const baseUrl = getBaseUrl(req);
    const rows = await this.prisma.restaurant.findMany({
      select: { slug: true, updatedAt: true, subscription: true },
      orderBy: { slug: 'asc' },
    });
    // Restaurants whose subscription is over are left out, their menu is offline.
    const now = new Date();
    const restaurants = rows.filter((row) => isServable(computeAccess(row.subscription, now)));
    const urls = restaurants
      .map(
        (r) =>
          `  <url><loc>${baseUrl}/m/${encodeURIComponent(r.slug)}</loc><lastmod>${r.updatedAt.toISOString()}</lastmod></url>`,
      )
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  }

  /** Liveness plus a database round trip, for load balancers and uptime checks. */
  @Get('health')
  async health(@Res() res: Response): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  }
}
