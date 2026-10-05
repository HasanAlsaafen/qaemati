import { Controller, Get, HttpCode, Param, Query, Render, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { MenuService } from './menu.service';
import { buildMenuLabels } from './menu-labels';
import { AnalyticsService } from '../admin/analytics.service';

@Controller('m')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly i18n: I18nService,
    private readonly analytics: AnalyticsService,
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
    @Query('previewSectionSpacing') previewSectionSpacing: string | undefined,
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
          sectionSpacing: previewSectionSpacing?.trim() || undefined,
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

  /** B2: a GET beacon (not POST) deliberately -- doubleCsrfProtection
   *  (applied globally in bootstrap.ts) ignores GET/HEAD/OPTIONS by
   *  default, so this stays a plain unauthenticated fetch from
   *  item-detail-sheet.njk with no CSRF plumbing needed, same as any
   *  other page-view beacon. 204 with no body; the client ignores the
   *  response either way. */
  @Get(':slug/items/:itemId/view')
  @HttpCode(204)
  async recordItemView(
    @Param('slug') slug: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const restaurantId = await this.menuService.getRestaurantIdBySlug(slug);
    // Same owner exclusion as the whole-menu view in show() above -- the
    // restaurant's own admin opening an item on their own menu shouldn't
    // inflate their own "most viewed" stats either.
    const isOwner = req.session.restaurantId === restaurantId;
    if (restaurantId && !isOwner) {
      await this.analytics.recordItemView(restaurantId, itemId);
    }
    res.setHeader('Cache-Control', 'no-store');
  }
}
