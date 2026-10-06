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
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { MenusService } from './menus.service';
import { MenusViewService } from './menus-view.service';
import { triggerToast } from './htmx-toast';
import { CreateMenuDto } from './dto/menu.dto';
import { MoveDto } from './dto/common.dto';

@Controller('admin/menus')
export class MenusController {
  constructor(
    private readonly menus: MenusService,
    private readonly view: MenusViewService,
    private readonly i18n: I18nService,
  ) {}

  private t(key: string, locale: string): string {
    return this.i18n.t(`common.admin.${key}`, { lang: locale });
  }

  /** Both or neither: a one sided time is treated as no window at all. */
  private window(body: CreateMenuDto) {
    const from = body.availableFrom?.trim();
    const to = body.availableTo?.trim();
    return from && to
      ? { availableFrom: from, availableTo: to }
      : { availableFrom: null, availableTo: null };
  }

  @Post()
  @Render('admin/partials/menus-panel')
  async create(
    @Body() body: CreateMenuDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const nameAr = body.nameAr?.trim();
    const nameEn = body.nameEn?.trim();

    if (!nameAr || !nameEn) {
      triggerToast(res, this.t('form.required', locale), 'danger');
      return this.view.build(restaurantId, locale);
    }
    const menu = await this.menus.create(restaurantId, { nameAr, nameEn, ...this.window(body) });
    triggerToast(res, this.t('menus.addedToast', locale));
    return this.view.build(restaurantId, locale, menu.id);
  }

  @Patch(':id')
  @Render('admin/partials/menus-panel')
  async update(
    @Param('id') id: string,
    @Body() body: CreateMenuDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const nameAr = body.nameAr?.trim();
    const nameEn = body.nameEn?.trim();

    if (!nameAr || !nameEn) {
      await this.menus.assertOwnership(restaurantId, id);
      triggerToast(res, this.t('form.required', locale), 'danger');
      return this.view.build(restaurantId, locale, id);
    }
    await this.menus.update(restaurantId, id, { nameAr, nameEn, ...this.window(body) });
    triggerToast(res, this.t('menus.savedToast', locale));
    return this.view.build(restaurantId, locale, id);
  }

  @Delete(':id')
  @Render('admin/partials/menus-panel')
  async remove(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    try {
      const target = await this.menus.remove(restaurantId, id);
      triggerToast(res, this.t('menus.deletedToast', locale));
      return this.view.build(restaurantId, locale, target.id);
    } catch (error) {
      if (error instanceof BadRequestException && error.message === 'LAST_MENU') {
        triggerToast(res, this.t('menus.lastMenuToast', locale), 'danger');
        return this.view.build(restaurantId, locale, id);
      }
      throw error;
    }
  }

  @Post(':id/move')
  @Render('admin/partials/menus-panel')
  async move(@Param('id') id: string, @Body() body: MoveDto, @Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    await this.menus.move(restaurantId, id, body.direction);
    return this.view.build(restaurantId, locale, id);
  }
}
