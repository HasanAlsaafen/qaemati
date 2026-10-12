import { Controller, Get, HttpCode, Param, Query, Render, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { MenuService } from './menu.service';
import { buildMenuLabels } from './menu-labels';
import { AnalyticsService } from '../admin/analytics.service';
import { buildRestaurantJsonLd, getBaseUrl, toAbsoluteUrl } from '../seo/seo';
import { GuestPosService } from '../pos/guest-pos.service';

@Controller('m')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly i18n: I18nService,
    private readonly analytics: AnalyticsService,
    private readonly guestPos: GuestPosService,
  ) {}

  @Get(':slug')
  @Render('pages/menu')
  async show(
    @Param('slug') slug: string,
    @Query('table') table: string | undefined,
    @Query('t') tableToken: string | undefined,
    @Query('menu') menuId: string | undefined,
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
    @Query('previewLogoShape') previewLogoShape: string | undefined,
    @Query('previewCoverHeight') previewCoverHeight: string | undefined,
    @Query('previewPriceStyle') previewPriceStyle: string | undefined,
    @Query('previewHeadingAlign') previewHeadingAlign: string | undefined,
    @Query('previewThemeDecor') previewThemeDecor: string | undefined,
    @Query('previewMenuLayout') previewMenuLayout: string | undefined,
    @Query('previewItemImages') previewItemImages: string | undefined,
    @Query('previewItemImageShape') previewItemImageShape: string | undefined,
    @Query('previewCategoryMarker') previewCategoryMarker: string | undefined,
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
          logoShape: previewLogoShape?.trim() || undefined,
          coverHeight: previewCoverHeight?.trim() || undefined,
          priceStyle: previewPriceStyle?.trim() || undefined,
          headingAlign: previewHeadingAlign?.trim() || undefined,
          themeDecor: previewThemeDecor?.trim() || undefined,
          menuLayout: previewMenuLayout?.trim() || undefined,
          itemImages: previewItemImages?.trim() || undefined,
          itemImageShape: previewItemImageShape?.trim() || undefined,
          categoryMarker: previewCategoryMarker?.trim() || undefined,
          backgroundStyle: previewBackgroundStyle?.trim() || undefined,
          backgroundPattern: previewBackgroundPattern?.trim() || undefined,
          sectionSpacing: previewSectionSpacing?.trim() || undefined,
        }
      : undefined;
    const menu = await this.menuService.getMenu(slug, locale, preview, menuId);
    // The QR code carries an unguessable token. A bare ?table=name still shows
    // the table on a WhatsApp order, but can never place one on the POS.
    const restaurantIdForTable = await this.menuService.getRestaurantIdBySlug(slug);
    const posTable = restaurantIdForTable
      ? await this.guestPos.tableContext(restaurantIdForTable, tableToken?.trim())
      : null;
    const baseUrl = getBaseUrl(req);
    const canonicalUrl = `${baseUrl}/m/${encodeURIComponent(slug)}`;
    const imageUrl = toAbsoluteUrl(baseUrl, menu.coverImageUrl ?? menu.logoUrl);
    return {
      menu,
      seo: {
        canonicalUrl,
        imageUrl,
        jsonLd: buildRestaurantJsonLd({
          name: menu.name,
          description: menu.description,
          url: canonicalUrl,
          imageUrl,
          menuUrl: canonicalUrl,
          telephone: menu.phone
            ? menu.phone.replace(/[^0-9+]/g, '')
            : menu.whatsappUrl
              ? `+${menu.whatsappUrl.replace(/\D/g, '')}`
              : null,
          address: menu.address,
          sameAs: [menu.instagramUrl, menu.facebookUrl].filter((url): url is string =>
            Boolean(url),
          ),
        }),
      },
      tableLabel: posTable?.label ?? (table?.trim() || null),
      tableOrder:
        posTable?.ordering && tableToken
          ? { token: tableToken.trim(), slug, locationCheck: posTable.locationCheck }
          : null,
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

  /** B4: a per-restaurant web app manifest -- `start_url` points at
   *  this exact restaurant's menu, so "Add to Home Screen" installs a
   *  shortcut to THIS menu, not a generic app. Falls back to the site
   *  favicon when the restaurant has no logo (a manifest with no
   *  usable icon fails Chrome's installability check outright). */
  @Get(':slug/manifest.webmanifest')
  async manifest(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const locale = req.locale ?? 'ar';
    const data = await this.menuService.getManifestData(slug, locale);
    if (!data) {
      res.status(404).send();
      return;
    }
    const icon = data.iconUrl
      ? { src: data.iconUrl, sizes: 'any', purpose: 'any' }
      : { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' };

    res.setHeader('Content-Type', 'application/manifest+json');
    res.json({
      name: data.name,
      short_name: data.name,
      start_url: `/m/${slug}`,
      scope: `/m/${slug}`,
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: data.themeColor,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      lang: locale,
      icons: [icon],
    });
  }
}
