import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Render,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { triggerToast } from '../admin/htmx-toast';
import { ValidationFailedException } from '../common/validation/validation-failed.exception';
import { RequiresFeature } from '../tenancy/requires-feature';
import { OrderStatusDto, PosSettingsDto } from './dto/pos.dto';
import { PosService } from './pos.service';
import { canEditSettings, canHandleCalls, canSetOrderStatus, parseRole, Role } from './roles';

const roleOf = (req: Request): Role => parseRole(req.session.adminRole) ?? 'OWNER';

const toNumber = (value: string | undefined): number | null =>
  value === undefined || value.trim() === '' ? null : Number(value);

const refuse = (): never => {
  throw new ForbiddenException('Your account cannot do this');
};

/**
 * The cashier and kitchen screen. Only for restaurants whose plan includes
 * table ordering. What each role may do is decided here and in roles.ts, on
 * the server: hiding a button is a courtesy, not the rule.
 */
@Controller('admin/pos')
@RequiresFeature('tableOrdering')
export class PosController {
  constructor(
    private readonly pos: PosService,
    private readonly i18n: I18nService,
  ) {}

  private async boardFor(req: Request) {
    const role = roleOf(req);
    return { role, ...(await this.pos.board(req.session.restaurantId as string, role)) };
  }

  @Get()
  @Render('admin/pos')
  async index(@Req() req: Request) {
    const role = roleOf(req);
    return {
      section: 'pos',
      ...(await this.boardFor(req)),
      location: canEditSettings(role)
        ? await this.pos.locationSettings(req.session.restaurantId as string)
        : null,
    };
  }

  @Get('board')
  @Render('admin/partials/pos-board')
  board(@Req() req: Request) {
    return this.boardFor(req);
  }

  @Post('orders/:id/status')
  @HttpCode(200)
  @Render('admin/partials/pos-board')
  async setStatus(@Param('id') id: string, @Body() body: OrderStatusDto, @Req() req: Request) {
    if (!canSetOrderStatus(roleOf(req), body.status)) refuse();
    await this.pos.setOrderStatus(
      req.session.restaurantId as string,
      id,
      body.status,
      req.session.adminUserId as string,
    );
    return this.boardFor(req);
  }

  @Post('calls/:id/acknowledge')
  @HttpCode(200)
  @Render('admin/partials/pos-board')
  async acknowledge(@Param('id') id: string, @Req() req: Request) {
    if (!canHandleCalls(roleOf(req))) refuse();
    await this.pos.setCallStatus(
      req.session.restaurantId as string,
      id,
      'ACKNOWLEDGED',
      req.session.adminUserId as string,
    );
    return this.boardFor(req);
  }

  @Post('calls/:id/resolve')
  @HttpCode(200)
  @Render('admin/partials/pos-board')
  async resolve(@Param('id') id: string, @Req() req: Request) {
    if (!canHandleCalls(roleOf(req))) refuse();
    await this.pos.setCallStatus(
      req.session.restaurantId as string,
      id,
      'RESOLVED',
      req.session.adminUserId as string,
    );
    return this.boardFor(req);
  }

  @Post('settings')
  async settings(
    @Body() body: PosSettingsDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!canEditSettings(roleOf(req))) refuse();
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
