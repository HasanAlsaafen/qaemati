import { Controller, Get, Req, Render } from '@nestjs/common';
import { Request } from 'express';
import { I18nService } from 'nestjs-i18n';
import { CategoryService } from './category.service';
import { toCategoryViewList } from './admin-view-model';
import { buildAdminLabels } from './admin-labels';

@Controller('admin')
export class DashboardController {
  constructor(
    private readonly categories: CategoryService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @Render('admin/dashboard')
  async index(@Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const categories = await this.categories.listForRestaurant(restaurantId);
    return {
      categories: toCategoryViewList(categories),
      labels: buildAdminLabels(this.i18n, locale),
    };
  }
}
