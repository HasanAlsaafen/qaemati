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
import { UpdateBrandingDto } from './dto/branding.dto';

/** What the user typed, so a rejected save does not wipe the form. */
function typedValues(body: UpdateBrandingDto): Record<string, string> {
  return Object.fromEntries(
    Object.entries(body).filter(
      (entry): entry is [string, string] =>
        entry[0] !== 'csrf_token' && typeof entry[1] === 'string',
    ),
  );
}

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
    @Body() body: UpdateBrandingDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const {
      nameAr,
      nameEn,
      descriptionAr,
      descriptionEn,
      whatsapp,
      instagramHandle,
      taglineAr,
      taglineEn,
      phone,
      facebookUrl,
      addressAr,
      addressEn,
      mapUrl,
      workingHoursAr,
      workingHoursEn,
      openTime,
      closeTime,
      currency,
      primaryColor,
      secondaryColor,
      fontTheme,
      menuDensity,
      cornerStyle,
      backgroundColor,
      cardStyle,
      buttonShape,
      categoryDivider,
      logoShape,
      coverHeight,
      priceStyle,
      headingAlign,
      menuLayout,
      itemImages,
      itemImageShape,
      categoryMarker,
      backgroundStyle,
      backgroundPattern,
      sectionSpacing,
    } = body;
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
        restaurant: { ...toRestaurantSettingsView(current), ...typedValues(body) },
        labels: buildAdminLabels(this.i18n, locale),
        fieldErrors,
      };
    }

    try {
      const restaurant = await this.restaurants.update(restaurantId, {
        nameAr: (nameAr ?? '').trim(),
        nameEn: (nameEn ?? '').trim(),
        descriptionAr: descriptionAr?.trim() || null,
        descriptionEn: descriptionEn?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        instagramHandle: instagramHandle?.trim() || null,
        taglineAr: taglineAr?.trim() || null,
        taglineEn: taglineEn?.trim() || null,
        phone: phone?.trim() || null,
        facebookUrl: facebookUrl?.trim() || null,
        addressAr: addressAr?.trim() || null,
        addressEn: addressEn?.trim() || null,
        mapUrl: mapUrl?.trim() || null,
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
        logoShape: logoShape?.trim(),
        coverHeight: coverHeight?.trim(),
        priceStyle: priceStyle?.trim(),
        headingAlign: headingAlign?.trim(),
        menuLayout: menuLayout?.trim(),
        itemImages: itemImages?.trim(),
        itemImageShape: itemImageShape?.trim(),
        categoryMarker: categoryMarker?.trim(),
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
        case 'INVALID_PHONE':
          toastMessage = t('common.admin.branding.invalidPhone');
          errorFieldErrors.phone = toastMessage;
          break;
        case 'INVALID_FACEBOOK':
          toastMessage = t('common.admin.branding.invalidFacebook');
          errorFieldErrors.facebookUrl = toastMessage;
          break;
        case 'INVALID_MAP_URL':
          toastMessage = t('common.admin.branding.invalidMapUrl');
          errorFieldErrors.mapUrl = toastMessage;
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
        restaurant: { ...toRestaurantSettingsView(current), ...typedValues(body) },
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
