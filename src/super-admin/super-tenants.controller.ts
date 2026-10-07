import { Body, Controller, Get, Param, Post, Query, Render, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { PlanLimitException } from '../tenancy/tenancy.exceptions';
import {
  ChangePlanDto,
  CreateTenantDto,
  SubscriptionSettingsDto,
  SubscriptionStatusDto,
  TenantAdminDto,
} from './dto/super.dto';
import { FieldError } from './field-error';
import { PlansService } from './plans.service';
import { actorOf, failField, failLimit, flashSuccess, safeValues } from './super-http';
import { TenantsService } from './tenants.service';

@Controller('super/restaurants')
export class SuperTenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly plans: PlansService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @Render('super/tenants')
  async index(@Query('q') q?: string, @Query('state') state?: string) {
    const allowed = ['ok', 'trial', 'grace', 'blocked'];
    return {
      rows: await this.tenants.list({
        q,
        state: state && allowed.includes(state) ? state : undefined,
      }),
      q: q ?? '',
      state: state ?? '',
    };
  }

  @Get('new')
  @Render('super/tenant-new')
  async newForm() {
    return { plans: await this.plans.listChoosable() };
  }

  @Post()
  async create(
    @Body() body: CreateTenantDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { restaurant, password } = await this.tenants.create(actorOf(req), body);
      flashSuccess(req, this.i18n, 'tenantCreated', {
        label: body.adminEmail.trim().toLowerCase(),
        value: password,
      });
      res.redirect(303, `/super/restaurants/${restaurant.id}`);
    } catch (error) {
      if (error instanceof FieldError)
        return failField(req, res, this.i18n, '/super/restaurants/new', error, safeValues(body));
      throw error;
    }
  }

  @Get(':id')
  @Render('super/tenant')
  async detail(@Param('id') id: string) {
    return { ...(await this.tenants.detail(id)), plans: await this.plans.list() };
  }

  @Post(':id/plan')
  async changePlan(
    @Param('id') id: string,
    @Body() body: ChangePlanDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const back = `/super/restaurants/${id}`;
    try {
      await this.tenants.changePlan(actorOf(req), id, body);
      flashSuccess(req, this.i18n, 'planChanged');
      res.redirect(303, back);
    } catch (error) {
      if (error instanceof FieldError) return failField(req, res, this.i18n, back, error);
      throw error;
    }
  }

  @Post(':id/status')
  async changeStatus(
    @Param('id') id: string,
    @Body() body: SubscriptionStatusDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.tenants.changeStatus(actorOf(req), id, body);
    flashSuccess(req, this.i18n, `status_${body.action}`);
    res.redirect(303, `/super/restaurants/${id}`);
  }

  @Post(':id/settings')
  async settings(
    @Param('id') id: string,
    @Body() body: SubscriptionSettingsDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.tenants.updateSettings(actorOf(req), id, body);
    flashSuccess(req, this.i18n, 'settingsSaved');
    res.redirect(303, `/super/restaurants/${id}`);
  }

  @Post(':id/admins')
  async addAdmin(
    @Param('id') id: string,
    @Body() body: TenantAdminDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const back = `/super/restaurants/${id}`;
    try {
      const password = await this.tenants.addAdmin(actorOf(req), id, body);
      flashSuccess(req, this.i18n, 'adminCreated', {
        label: body.email.trim().toLowerCase(),
        value: password,
      });
      res.redirect(303, back);
    } catch (error) {
      if (error instanceof FieldError)
        return failField(req, res, this.i18n, back, error, safeValues(body));
      if (error instanceof PlanLimitException) return failLimit(req, res, this.i18n, back, error);
      throw error;
    }
  }

  @Post(':id/admins/:adminId/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @Param('adminId') adminId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { email, password } = await this.tenants.resetAdminPassword(actorOf(req), id, adminId);
    flashSuccess(req, this.i18n, 'passwordReset', { label: email, value: password });
    res.redirect(303, `/super/restaurants/${id}`);
  }

  @Post(':id/admins/:adminId/remove')
  async removeAdmin(
    @Param('id') id: string,
    @Param('adminId') adminId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const back = `/super/restaurants/${id}`;
    try {
      await this.tenants.removeAdmin(actorOf(req), id, adminId);
      flashSuccess(req, this.i18n, 'adminRemoved');
      res.redirect(303, back);
    } catch (error) {
      if (error instanceof FieldError) return failField(req, res, this.i18n, back, error);
      throw error;
    }
  }
}
