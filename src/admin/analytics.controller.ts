import { RequiresFeature } from '../tenancy/requires-feature';
import { Controller, Get, Req, Render } from '@nestjs/common';
import { Request } from 'express';
import { I18nService } from 'nestjs-i18n';
import { AnalyticsService } from './analytics.service';
import { buildAdminLabels } from './admin-labels';

@RequiresFeature('analytics')
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @Render('admin/analytics')
  async index(@Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const stats = await this.analytics.getStats(restaurantId);
    return {
      stats,
      labels: buildAdminLabels(this.i18n, locale),
    };
  }
}
