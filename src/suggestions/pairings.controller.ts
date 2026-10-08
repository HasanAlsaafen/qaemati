import { Body, Controller, Get, HttpCode, Param, Post, Render, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { triggerToast } from '../admin/htmx-toast';
import { PairingsDto } from './dto/pairings.dto';
import { PairingsService } from './pairings.service';

/** The owner's "goes well with" list for one dish. Owners only: the role middleware keeps staff out. */
@Controller('admin/items/:id/pairings')
export class PairingsController {
  constructor(
    private readonly pairings: PairingsService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @Render('admin/partials/item-pairings')
  async show(@Param('id') id: string, @Req() req: Request) {
    return this.pairings.choices(req.session.restaurantId as string, id);
  }

  @Post()
  @HttpCode(200)
  @Render('admin/partials/item-pairings')
  async save(
    @Param('id') id: string,
    @Body() body: PairingsDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    await this.pairings.save(restaurantId, id, body.pairings ?? []);
    triggerToast(res, this.i18n.t('common.admin.pairings.saved', { lang: req.locale ?? 'ar' }));
    return this.pairings.choices(restaurantId, id);
  }
}
