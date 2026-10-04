import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Req,
  Res,
  Render,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { ItemTag } from '@prisma/client';
import { ALL_TAGS } from '../common/tags';
import { CategoryService } from './category.service';
import { ItemService } from './item.service';
import { buildAdminLabels } from './admin-labels';
import { toCategoryViewList } from './admin-view-model';
import { triggerToast } from './htmx-toast';
import { itemImageMulterOptions } from './upload.config';

function parseTags(raw: string | string[] | undefined): ItemTag[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.filter((value): value is ItemTag => (ALL_TAGS as string[]).includes(value));
}

@Controller('admin')
export class ItemsController {
  constructor(
    private readonly items: ItemService,
    private readonly categories: CategoryService,
    private readonly i18n: I18nService,
  ) {}

  @Post('categories/:categoryId/items')
  @Render('admin/partials/category')
  async create(
    @Param('categoryId') categoryId: string,
    @Body('nameAr') nameAr: string,
    @Body('nameEn') nameEn: string,
    @Body('price') price: string,
    @Body('currency') currency: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const priceValue = Number(price);

    if (!nameAr?.trim() || !nameEn?.trim()) {
      triggerToast(res, this.i18n.t('common.admin.form.required', { lang: locale }), 'danger');
    } else if (!Number.isFinite(priceValue) || priceValue < 0) {
      triggerToast(res, this.i18n.t('common.admin.form.invalidPrice', { lang: locale }), 'danger');
    } else {
      await this.items.create(restaurantId, categoryId, {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        price: priceValue,
        currency: (currency || 'ILS').trim(),
        tags: [],
      });
      triggerToast(res, this.i18n.t('common.admin.items.addedToast', { lang: locale }));
    }

    const category = await this.categories.findOneWithItems(categoryId);
    return {
      category: toCategoryViewList([category])[0],
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Patch('items/:id')
  @Render('admin/partials/item')
  async update(
    @Param('id') id: string,
    @Body('nameAr') nameAr: string,
    @Body('nameEn') nameEn: string,
    @Body('descriptionAr') descriptionAr: string,
    @Body('descriptionEn') descriptionEn: string,
    @Body('price') price: string,
    @Body('currency') currency: string,
    @Body('tags') tags: string | string[] | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const priceValue = Number(price);

    await this.items.update(restaurantId, id, {
      nameAr: nameAr?.trim() || '',
      nameEn: nameEn?.trim() || '',
      descriptionAr: descriptionAr?.trim() || null,
      descriptionEn: descriptionEn?.trim() || null,
      price: Number.isFinite(priceValue) && priceValue >= 0 ? priceValue : 0,
      currency: (currency || 'ILS').trim(),
      tags: parseTags(tags),
    });
    triggerToast(res, this.i18n.t('common.admin.items.savedToast', { lang: locale }));

    const item = await this.items.assertOwnership(restaurantId, id);
    return {
      item: { ...item, priceFormatted: Number(item.price).toFixed(2) },
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Patch('items/:id/availability')
  @Render('admin/partials/item')
  async toggleAvailability(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const item = await this.items.toggleAvailability(restaurantId, id);
    triggerToast(
      res,
      this.i18n.t(
        item.available
          ? 'common.admin.items.availabilityOnToast'
          : 'common.admin.items.availabilityOffToast',
        { lang: locale },
      ),
    );
    return {
      item: { ...item, priceFormatted: Number(item.price).toFixed(2) },
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Post('items/:id/image')
  @Render('admin/partials/item')
  @UseInterceptors(FileInterceptor('image', itemImageMulterOptions))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';

    if (!file) {
      throw new BadRequestException('No image uploaded');
    }

    const item = await this.items.setImage(restaurantId, id, `/uploads/items/${file.filename}`);
    triggerToast(res, this.i18n.t('common.admin.items.imageUpdatedToast', { lang: locale }));

    return {
      item: { ...item, priceFormatted: Number(item.price).toFixed(2) },
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Delete('items/:id')
  async remove(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    await this.items.remove(restaurantId, id);
    triggerToast(res, this.i18n.t('common.admin.items.deletedToast', { lang: locale }));
    res.status(200).send('');
  }

  @Post('items/:id/move')
  @Render('admin/partials/category')
  async move(
    @Param('id') id: string,
    @Body('direction') direction: 'up' | 'down',
    @Req() req: Request,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const item = await this.items.assertOwnership(restaurantId, id);
    await this.items.move(restaurantId, id, direction);
    const category = await this.categories.findOneWithItems(item.categoryId);
    return {
      category: toCategoryViewList([category])[0],
      labels: buildAdminLabels(this.i18n, locale),
    };
  }
}
