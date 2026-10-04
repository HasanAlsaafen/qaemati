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
    @Req() req: Request,
  ) {
    const locale = req.locale ?? 'ar';
    const menu = await this.menuService.getMenu(slug, locale);
    return {
      menu,
      tableLabel: table?.trim() || null,
      labels: buildMenuLabels(this.i18n, locale),
    };
  }
}
