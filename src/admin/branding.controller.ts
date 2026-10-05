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
      fieldErrors: {},
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
    @Body('secondaryColor') secondaryColor: string,
    @Body('fontTheme') fontTheme: string,
    @Body('menuDensity') menuDensity: string,
    @Body('cornerStyle') cornerStyle: string,
    @Body('backgroundColor') backgroundColor: string,
    @Body('cardStyle') cardStyle: string,
    @Body('buttonShape') buttonShape: string,
    @Body('categoryDivider') categoryDivider: string,
    @Body('backgroundStyle') backgroundStyle: string,
    @Body('backgroundPattern') backgroundPattern: string,
    @Body('sectionSpacing') sectionSpacing: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const requiredMessage = this.i18n.t('common.admin.form.required', { lang: locale });

    const fieldErrors: Record<string, string> = {};
    if (!nameAr?.trim()) fieldErrors.nameAr = requiredMessage;
    if (!nameEn?.trim()) fieldErrors.nameEn = requiredMessage;

    if (Object.keys(fieldErrors).length > 0) {
      triggerToast(res, requiredMessage, 'danger');
      const current = await this.restaurants.findById(restaurantId);
      return {
        restaurant: toRestaurantSettingsView(current),
        labels: buildAdminLabels(this.i18n, locale),
        fieldErrors,
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
        secondaryColor: secondaryColor?.trim() || null,
        fontTheme: fontTheme?.trim(),
        menuDensity: menuDensity?.trim(),
        cornerStyle: cornerStyle?.trim(),
        backgroundColor: backgroundColor?.trim() || null,
        cardStyle: cardStyle?.trim(),
        buttonShape: buttonShape?.trim(),
        categoryDivider: categoryDivider?.trim(),
        backgroundStyle: backgroundStyle?.trim(),
        backgroundPattern: backgroundPattern?.trim(),
        sectionSpacing: sectionSpacing?.trim(),
      });
      triggerToast(res, this.i18n.t('common.admin.branding.savedToast', { lang: locale }));
      return {
        restaurant: toRestaurantSettingsView(restaurant),
        labels: buildAdminLabels(this.i18n, locale),
        fieldErrors: {},
      };
    } catch (error) {
      const current = await this.restaurants.findById(restaurantId);
      const code = error instanceof BadRequestException ? error.message : null;
      // Maps each field-specific error code (see RestaurantService) to the
      // one input it belongs to, so the form can point at exactly what's
      // wrong instead of leaving the admin to guess from a toast alone --
      // the P1-4 gap flagged in docs/ux/audit.md, deferred from Phase 8
      // to here once a form with per-field rules (A4's colors/hours)
      // actually needed it.
      const t = (key: string): string => this.i18n.t(key, { lang: locale }) as string;
      const errorFieldErrors: Record<string, string> = {};
      let toastMessage: string | null = null;
      switch (code) {
        case 'PRIMARY_COLOR_CONTRAST_TOO_LOW':
          toastMessage = t('common.admin.branding.colorContrastToast');
          errorFieldErrors.primaryColor = toastMessage;
          break;
        case 'INVALID_PRIMARY_COLOR':
          toastMessage = t('common.admin.branding.invalidColorToast');
          errorFieldErrors.primaryColor = toastMessage;
          break;
        case 'SECONDARY_COLOR_CONTRAST_TOO_LOW':
          toastMessage = t('common.admin.branding.colorContrastToast');
          errorFieldErrors.secondaryColor = toastMessage;
          break;
        case 'INVALID_SECONDARY_COLOR':
          toastMessage = t('common.admin.branding.invalidColorToast');
          errorFieldErrors.secondaryColor = toastMessage;
          break;
        case 'BACKGROUND_COLOR_CONTRAST_TOO_LOW':
          toastMessage = t('common.admin.branding.backgroundColorContrastToast');
          errorFieldErrors.backgroundColor = toastMessage;
          break;
        case 'INVALID_BACKGROUND_COLOR':
          toastMessage = t('common.admin.branding.invalidColorToast');
          errorFieldErrors.backgroundColor = toastMessage;
          break;
        case 'OPEN_CLOSE_BOTH_REQUIRED':
          toastMessage = t('common.admin.branding.bothHoursRequiredToast');
          // Whichever one the admin left blank is the field to flag --
          // the other one (the one they did fill in) isn't the problem.
          errorFieldErrors[openTime?.trim() ? 'closeTime' : 'openTime'] = requiredMessage;
          break;
        case 'INVALID_FONT_THEME':
        case 'INVALID_MENU_DENSITY':
        case 'INVALID_CORNER_STYLE':
        case 'INVALID_CARD_STYLE':
        case 'INVALID_BUTTON_SHAPE':
        case 'INVALID_CATEGORY_DIVIDER':
        case 'INVALID_BACKGROUND_STYLE':
        case 'INVALID_BACKGROUND_PATTERN':
        case 'INVALID_SECTION_SPACING':
          // Only reachable via a tampered request (the form only ever
          // submits one of the two radio values per group) -- a toast is
          // enough, no specific input to point at.
          toastMessage = requiredMessage;
          break;
      }
      if (!toastMessage) throw error;
      triggerToast(res, toastMessage, 'danger');
      return {
        restaurant: toRestaurantSettingsView(current),
        labels: buildAdminLabels(this.i18n, locale),
        fieldErrors: errorFieldErrors,
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

  @Post('background')
  @Render('admin/partials/branding-images')
  @UseInterceptors(FileInterceptor('image', restaurantImageMulterOptions))
  async uploadBackground(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    if (!file) throw new BadRequestException('No image uploaded');

    const restaurant = await this.restaurants.setBackgroundImage(
      restaurantId,
      `/uploads/restaurants/${file.filename}`,
    );
    triggerToast(
      res,
      this.i18n.t('common.admin.branding.backgroundImageUpdatedToast', { lang: locale }),
    );
    return {
      restaurant: toRestaurantSettingsView(restaurant),
      labels: buildAdminLabels(this.i18n, locale),
    };
  }
}
