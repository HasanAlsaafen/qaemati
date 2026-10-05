import { Controller, Get, Param, Query, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { I18nService } from 'nestjs-i18n';
import { MenuService } from './menu.service';
import { buildMenuLabels } from './menu-labels';

@Controller('m')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly i18n: I18nService,
  ) {}

  @Get(':slug')
  @Render('pages/menu')
  async show(
    @Param('slug') slug: string,
    @Query('table') table: string | undefined,
    @Query('previewName') previewName: string | undefined,
    @Query('previewPrimaryColor') previewPrimaryColor: string | undefined,
    @Query('previewSecondaryColor') previewSecondaryColor: string | undefined,
    @Query('previewFontTheme') previewFontTheme: string | undefined,
    @Query('previewMenuDensity') previewMenuDensity: string | undefined,
    @Query('previewCornerStyle') previewCornerStyle: string | undefined,
    @Query('previewBackgroundColor') previewBackgroundColor: string | undefined,
    @Query('previewCardStyle') previewCardStyle: string | undefined,
    @Query('previewButtonShape') previewButtonShape: string | undefined,
    @Query('previewCategoryDivider') previewCategoryDivider: string | undefined,
    @Query('previewBackgroundStyle') previewBackgroundStyle: string | undefined,
    @Query('previewBackgroundPattern') previewBackgroundPattern: string | undefined,
    @Query('embed') embed: string | undefined,
    @Req() req: Request,
  ) {
    const locale = req.locale ?? 'ar';
    // Only the branding page's own live-preview iframe sends these --
    // see MenuPreviewOverrides's comment in menu.service.ts for why an
    // active admin session (not just a slug match) gates them.
    const restaurantId = req.session.restaurantId as string | undefined;
    const preview = restaurantId
      ? {
          restaurantId,
          name: previewName?.trim() || undefined,
          primaryColor: previewPrimaryColor?.trim() || undefined,
          secondaryColor: previewSecondaryColor?.trim() || undefined,
          fontTheme: previewFontTheme?.trim() || undefined,
          menuDensity: previewMenuDensity?.trim() || undefined,
          cornerStyle: previewCornerStyle?.trim() || undefined,
          backgroundColor: previewBackgroundColor?.trim() || undefined,
          cardStyle: previewCardStyle?.trim() || undefined,
          buttonShape: previewButtonShape?.trim() || undefined,
          categoryDivider: previewCategoryDivider?.trim() || undefined,
          backgroundStyle: previewBackgroundStyle?.trim() || undefined,
          backgroundPattern: previewBackgroundPattern?.trim() || undefined,
        }
      : undefined;
    const menu = await this.menuService.getMenu(slug, locale, preview);
    return {
      menu,
      tableLabel: table?.trim() || null,
      // Purely cosmetic (hides the scrollbar inside the branding page's
      // iframe preview, see src/styles/app.css's .embed-frame rule) --
      // never gated, since it reveals nothing and changes nothing a
      // visitor couldn't already see on the plain page.
      embed: embed === '1',
      labels: buildMenuLabels(this.i18n, locale),
    };
  }
}
