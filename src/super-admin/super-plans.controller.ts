import { Body, Controller, Get, Param, Post, Render, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { PLAN_FEATURES } from '../tenancy/plan-features';
import { PlanDto } from './dto/super.dto';
import { PlansService } from './plans.service';
import { actorOf, flashSuccess } from './super-http';

@Controller('super/plans')
export class SuperPlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @Render('super/plans')
  async index() {
    return { plans: await this.plans.list() };
  }

  @Get('new')
  @Render('super/plan-form')
  newForm() {
    return { plan: null, allFeatures: PLAN_FEATURES };
  }

  @Post()
  async create(@Body() body: PlanDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    await this.plans.create(actorOf(req), body);
    flashSuccess(req, this.i18n, 'planCreated');
    res.redirect(303, '/super/plans');
  }

  @Get(':id')
  @Render('super/plan-form')
  async edit(@Param('id') id: string) {
    return { plan: await this.plans.get(id), allFeatures: PLAN_FEATURES };
  }

  @Post(':id')
  async update(
    @Param('id') id: string,
    @Body() body: PlanDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.plans.update(actorOf(req), id, body);
    flashSuccess(req, this.i18n, 'planSaved');
    res.redirect(303, '/super/plans');
  }

  @Post(':id/archive')
  async archive(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    await this.plans.setActive(actorOf(req), id, false);
    flashSuccess(req, this.i18n, 'planArchived');
    res.redirect(303, '/super/plans');
  }

  @Post(':id/restore')
  async restore(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    await this.plans.setActive(actorOf(req), id, true);
    flashSuccess(req, this.i18n, 'planRestored');
    res.redirect(303, '/super/plans');
  }
}
