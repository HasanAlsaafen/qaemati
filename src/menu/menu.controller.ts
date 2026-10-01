import { Controller, Get, Param, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { MenuService } from './menu.service';

@Controller('m')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get(':slug')
  @Render('pages/menu')
  async show(@Param('slug') slug: string, @Req() req: Request) {
    const locale = req.locale ?? 'ar';
    const menu = await this.menuService.getMenu(slug, locale);
    return { menu };
  }
}
