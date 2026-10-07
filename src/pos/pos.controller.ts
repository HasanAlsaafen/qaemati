import { Body, Controller, Get, HttpCode, Param, Post, Render, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { triggerToast } from '../admin/htmx-toast';
import { RequiresFeature } from '../tenancy/requires-feature';
import { ValidationFailedException } from '../common/validation/validation-failed.exception';
import { OrderStatusDto, PosSettingsDto } from './dto/pos.dto';
import { PosService } from './pos.service';

const toNumber = (value: string | undefined): number | null =>
  value === undefined || value.trim() === '' ? null : Number(value);

/** The cashier and kitchen screen. Only for restaurants whose plan includes table ordering. */
@Controller('admin/pos')
@RequiresFeature('tableOrdering')
export class PosController {
  constructor(
    private readonly pos: PosService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @Render('admin/pos')
  async index(@Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    return {
      section: 'pos',
      ...(await this.pos.board(restaurantId)),
      location: await this.pos.locationSettings(restaurantId),
    };
  }

  @Get('board')
  @Render('admin/partials/pos-board')
  async board(@Req() req: Request) {
    return this.pos.board(req.session.restaurantId as string);
  }

  @Post('orders/:id/status')
  @HttpCode(200)
  @Render('admin/partials/pos-board')
  async setStatus(@Param('id') id: string, @Body() body: OrderStatusDto, @Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    await this.pos.setOrderStatus(restaurantId, id, body.status, req.session.adminUserId as string);
    return this.pos.board(restaurantId);
  }

  @Post('calls/:id/acknowledge')
  @HttpCode(200)
  @Render('admin/partials/pos-board')
  async acknowledge(@Param('id') id: string, @Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    await this.pos.setCallStatus(
      restaurantId,
      id,
      'ACKNOWLEDGED',
      req.session.adminUserId as string,
    );
    return this.pos.board(restaurantId);
  }

  @Post('calls/:id/resolve')
  @HttpCode(200)
  @Render('admin/partials/pos-board')
  async resolve(@Param('id') id: string, @Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    await this.pos.setCallStatus(restaurantId, id, 'RESOLVED', req.session.adminUserId as string);
    return this.pos.board(restaurantId);
  }

  @Post('settings')
  async settings(
    @Body() body: PosSettingsDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const latitude = toNumber(body.latitude);
    const longitude = toNumber(body.longitude);
    const radius = Number(body.orderRadiusMeters);
    const problems: Record<string, string[]> = {};
    if ((latitude === null) !== (longitude === null)) {
      problems[latitude === null ? 'latitude' : 'longitude'] = ['required'];
    }
    if (latitude !== null && Math.abs(latitude) > 90) problems.latitude = ['invalidNumber'];
    if (longitude !== null && Math.abs(longitude) > 180) problems.longitude = ['invalidNumber'];
    if (radius < 30 || radius > 2000) problems.orderRadiusMeters = ['invalidInteger'];
    if (Object.keys(problems).length > 0) {
      throw new ValidationFailedException(problems, { ...body });
    }
    await this.pos.saveLocationSettings(req.session.restaurantId as string, {
      latitude,
      longitude,
      orderRadiusMeters: radius,
      requireLocationCheck: Boolean(body.requireLocationCheck),
    });
    triggerToast(res, this.i18n.t('common.admin.pos.saved', { lang: req.locale ?? 'ar' }));
    res.status(204).end();
  }
}
