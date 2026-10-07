import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  Render,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import { TableService } from './table.service';
import { buildAdminLabels } from './admin-labels';
import { buildMenuUrl, generateQrSvg } from './qr-code';
import { triggerToast } from './htmx-toast';
import { TableLabelDto } from './dto/table.dto';
import { MoveDto } from './dto/common.dto';

interface TableView {
  id: string;
  label: string;
  url: string;
  qrSvg: string;
}

@Controller('admin/qr')
export class QrController {
  constructor(
    private readonly tables: TableService,
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @Render('admin/qr')
  async index(@Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    const slug = req.session.restaurantSlug as string;
    const locale = req.locale ?? 'ar';

    const generalUrl = buildMenuUrl(req, slug);
    const [generalQrSvg, tableViews] = await Promise.all([
      generateQrSvg(generalUrl),
      this.buildTableViews(req, restaurantId, slug),
    ]);

    return {
      generalUrl,
      generalQrSvg,
      tables: tableViews,
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Get('print')
  @Render('admin/qr-print')
  async print(@Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    const slug = req.session.restaurantSlug as string;
    const locale = req.locale ?? 'ar';

    const restaurant = await this.prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
    });
    const restaurantName = locale === 'ar' ? restaurant.nameAr : restaurant.nameEn;

    const generalUrl = buildMenuUrl(req, slug);
    const [generalQrSvg, tableViews] = await Promise.all([
      generateQrSvg(generalUrl),
      this.buildTableViews(req, restaurantId, slug),
    ]);

    return {
      restaurantName,
      generalQrSvg,
      tables: tableViews,
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Post('tables')
  @Render('admin/partials/tables-list')
  async create(
    @Body() body: TableLabelDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { label } = body;
    const restaurantId = req.session.restaurantId as string;
    const slug = req.session.restaurantSlug as string;
    const locale = req.locale ?? 'ar';

    if (label?.trim()) {
      await this.tables.create(restaurantId, label.trim());
      triggerToast(res, this.i18n.t('common.admin.qr.addedToast', { lang: locale }));
    } else {
      triggerToast(res, this.i18n.t('common.admin.form.required', { lang: locale }), 'danger');
    }

    return {
      tables: await this.buildTableViews(req, restaurantId, slug),
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Patch('tables/:id')
  @Render('admin/partials/table-row')
  async update(
    @Param('id') id: string,
    @Body() body: TableLabelDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { label } = body;
    const restaurantId = req.session.restaurantId as string;
    const slug = req.session.restaurantSlug as string;
    const locale = req.locale ?? 'ar';

    await this.tables.update(restaurantId, id, label?.trim() || '');
    triggerToast(res, this.i18n.t('common.admin.qr.savedToast', { lang: locale }));

    const tableViews = await this.buildTableViews(req, restaurantId, slug);
    const index = tableViews.findIndex((t) => t.id === id);
    return {
      table: tableViews[index],
      isFirst: index === 0,
      isLast: index === tableViews.length - 1,
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  @Delete('tables/:id')
  async remove(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    await this.tables.remove(restaurantId, id);
    triggerToast(res, this.i18n.t('common.admin.qr.deletedToast', { lang: locale }));
    res.status(200).send('');
  }

  @Post('tables/:id/move')
  @Render('admin/partials/tables-list')
  async move(@Param('id') id: string, @Body() body: MoveDto, @Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    const slug = req.session.restaurantSlug as string;
    const locale = req.locale ?? 'ar';

    await this.tables.move(restaurantId, id, body.direction);

    return {
      tables: await this.buildTableViews(req, restaurantId, slug),
      labels: buildAdminLabels(this.i18n, locale),
    };
  }

  private async buildTableViews(
    req: Request,
    restaurantId: string,
    slug: string,
  ): Promise<TableView[]> {
    const rows = await this.tables.listForRestaurant(restaurantId);
    return Promise.all(
      rows.map(async (row) => {
        const url = buildMenuUrl(req, slug, row.token);
        return { id: row.id, label: row.label, url, qrSvg: await generateQrSvg(url) };
      }),
    );
  }
}
