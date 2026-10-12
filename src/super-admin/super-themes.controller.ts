import { Body, Controller, Get, Param, Post, Render, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { THEME_CHOICE_FIELDS, themeChoices } from '../admin/themes';
import { CreateThemeDto, ThemeDto } from './dto/super.dto';
import { FieldError } from './field-error';
import { actorOf, failField, flashSuccess, safeValues } from './super-http';
import { ThemesAdminService } from './themes-admin.service';

/** The choices each select offers, for the form. */
const choices = () =>
  Object.fromEntries(
    THEME_CHOICE_FIELDS.map((f) => [f, themeChoices(f).map((v) => ({ value: v, label: v }))]),
  );

@Controller('super/themes')
export class SuperThemesController {
  constructor(
    private readonly themes: ThemesAdminService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @Render('super/themes')
  async index() {
    return { themes: await this.themes.list() };
  }

  @Get('new')
  @Render('super/theme-form')
  newForm() {
    return { theme: null, choices: choices() };
  }

  @Post()
  async create(
    @Body() body: CreateThemeDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.themes.create(actorOf(req), body);
    } catch (error) {
      if (error instanceof FieldError) {
        return failField(req, res, this.i18n, '/super/themes/new', error, safeValues(body));
      }
      throw error;
    }
    flashSuccess(req, this.i18n, 'themeCreated');
    res.redirect(303, '/super/themes');
  }

  @Get(':id')
  @Render('super/theme-form')
  async edit(@Param('id') id: string) {
    return { theme: await this.themes.get(id), choices: choices() };
  }

  @Post(':id')
  async update(
    @Param('id') id: string,
    @Body() body: ThemeDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.themes.update(actorOf(req), id, body);
    } catch (error) {
      if (error instanceof FieldError) {
        return failField(req, res, this.i18n, `/super/themes/${id}`, error, safeValues(body));
      }
      throw error;
    }
    flashSuccess(req, this.i18n, 'themeSaved');
    res.redirect(303, '/super/themes');
  }

  @Post(':id/archive')
  async archive(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    await this.themes.setActive(actorOf(req), id, false);
    flashSuccess(req, this.i18n, 'themeArchived');
    res.redirect(303, '/super/themes');
  }

  @Post(':id/restore')
  async restore(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    await this.themes.setActive(actorOf(req), id, true);
    flashSuccess(req, this.i18n, 'themeRestored');
    res.redirect(303, '/super/themes');
  }
}
