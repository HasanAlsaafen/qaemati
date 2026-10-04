import { Body, Controller, Delete, Param, Patch, Post, Req, Res, Render } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { CategoryService } from './category.service';
import { buildAdminLabels } from './admin-labels';
import { toCategoryViewList } from './admin-view-model';
import { triggerToast } from './htmx-toast';

@Controller('admin/categories')
export class CategoriesController {
  constructor(
    private readonly categories: CategoryService,
    private readonly i18n: I18nService,
  ) {}

  @Post()
  @Render('admin/partials/categories-list')
  async create(
    @Body('nameAr') nameAr: string,
    @Body('nameEn') nameEn: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';

    if (nameAr?.trim() && nameEn?.trim()) {
      await this.categories.create(restaurantId, { nameAr: nameAr.trim(), nameEn: nameEn.trim() });
      triggerToast(res, this.i18n.t('common.admin.categories.addedToast', { lang: locale }));
    } else {
      triggerToast(res, this.i18n.t('common.admin.form.required', { lang: locale }), 'danger');
    }

    const categories = await this.categories.listForRestaurant(restaurantId);
    return {
      categories: toCategoryViewList(categories),
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Patch(':id')
  @Render('admin/partials/category')
  async update(
    @Param('id') id: string,
    @Body('nameAr') nameAr: string,
    @Body('nameEn') nameEn: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';

    await this.categories.update(restaurantId, id, {
      nameAr: nameAr?.trim() || '',
      nameEn: nameEn?.trim() || '',
    });
    triggerToast(res, this.i18n.t('common.admin.categories.savedToast', { lang: locale }));

    const category = await this.categories.findOneWithItems(id);
    return {
      category: toCategoryViewList([category])[0],
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    await this.categories.remove(restaurantId, id);
    triggerToast(res, this.i18n.t('common.admin.categories.deletedToast', { lang: locale }));
    res.status(200).send('');
  }

  @Post(':id/move')
  @Render('admin/partials/categories-list')
  async move(
    @Param('id') id: string,
    @Body('direction') direction: 'up' | 'down',
    @Req() req: Request,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    await this.categories.move(restaurantId, id, direction);
    const categories = await this.categories.listForRestaurant(restaurantId);
    return {
      categories: toCategoryViewList(categories),
      labels: buildAdminLabels(this.i18n, locale),
    };
  }
}
