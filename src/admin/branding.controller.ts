import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { buildAdminLabels } from './admin-labels';
import { toRestaurantSettingsView } from './admin-view-model';
import { RestaurantService } from './restaurant.service';
import { triggerToast } from './htmx-toast';
import { restaurantImageMulterOptions } from './upload.config';

@Controller('admin/branding')
export class BrandingController {
  constructor(
    private readonly restaurants: RestaurantService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @Render('admin/branding')
  async index(@Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const restaurant = await this.restaurants.findById(restaurantId);
    return {
      restaurant: toRestaurantSettingsView(restaurant),
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Patch()
  @Render('admin/partials/branding-form')
  async update(
    @Body('nameAr') nameAr: string,
    @Body('nameEn') nameEn: string,
    @Body('descriptionAr') descriptionAr: string,
    @Body('descriptionEn') descriptionEn: string,
    @Body('whatsapp') whatsapp: string,
    @Body('instagramHandle') instagramHandle: string,
    @Body('workingHoursAr') workingHoursAr: string,
    @Body('workingHoursEn') workingHoursEn: string,
    @Body('openTime') openTime: string,
    @Body('closeTime') closeTime: string,
    @Body('currency') currency: string,
    @Body('primaryColor') primaryColor: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';

    if (!nameAr?.trim() || !nameEn?.trim()) {
      triggerToast(res, this.i18n.t('common.admin.form.required', { lang: locale }), 'danger');
      const current = await this.restaurants.findById(restaurantId);
      return {
        restaurant: toRestaurantSettingsView(current),
        labels: buildAdminLabels(this.i18n, locale),
      };
    }

    try {
      const restaurant = await this.restaurants.update(restaurantId, {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        descriptionAr: descriptionAr?.trim() || null,
        descriptionEn: descriptionEn?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        instagramHandle: instagramHandle?.trim() || null,
        workingHoursAr: workingHoursAr?.trim() || null,
        workingHoursEn: workingHoursEn?.trim() || null,
        openTime: openTime?.trim() || null,
        closeTime: closeTime?.trim() || null,
        currency: (currency || 'ILS').trim(),
        primaryColor: primaryColor?.trim() || null,
      });
      triggerToast(res, this.i18n.t('common.admin.branding.savedToast', { lang: locale }));
      return {
        restaurant: toRestaurantSettingsView(restaurant),
        labels: buildAdminLabels(this.i18n, locale),
      };
    } catch (error) {
      const current = await this.restaurants.findById(restaurantId);
      const message =
        error instanceof BadRequestException && error.message === 'COLOR_CONTRAST_TOO_LOW'
          ? this.i18n.t('common.admin.branding.colorContrastToast', { lang: locale })
          : error instanceof BadRequestException && error.message === 'INVALID_COLOR'
            ? this.i18n.t('common.admin.branding.invalidColorToast', { lang: locale })
            : error instanceof BadRequestException && error.message === 'OPEN_CLOSE_BOTH_REQUIRED'
              ? this.i18n.t('common.admin.branding.bothHoursRequiredToast', { lang: locale })
              : null;
      if (!message) throw error;
      triggerToast(res, message, 'danger');
      return {
        restaurant: toRestaurantSettingsView(current),
        labels: buildAdminLabels(this.i18n, locale),
      };
    }
  }

  @Post('logo')
  @Render('admin/partials/branding-images')
  @UseInterceptors(FileInterceptor('image', restaurantImageMulterOptions))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    if (!file) throw new BadRequestException('No image uploaded');

    const restaurant = await this.restaurants.setLogo(
      restaurantId,
      `/uploads/restaurants/${file.filename}`,
    );
    triggerToast(res, this.i18n.t('common.admin.branding.logoUpdatedToast', { lang: locale }));
    return {
      restaurant: toRestaurantSettingsView(restaurant),
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Post('cover')
  @Render('admin/partials/branding-images')
  @UseInterceptors(FileInterceptor('image', restaurantImageMulterOptions))
  async uploadCover(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    if (!file) throw new BadRequestException('No image uploaded');

    const restaurant = await this.restaurants.setCoverImage(
      restaurantId,
      `/uploads/restaurants/${file.filename}`,
    );
    triggerToast(
      res,
      this.i18n.t('common.admin.branding.coverImageUpdatedToast', { lang: locale }),
    );
    return {
      restaurant: toRestaurantSettingsView(restaurant),
      labels: buildAdminLabels(this.i18n, locale),
    };
  }
}
