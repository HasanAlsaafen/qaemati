import { Controller, Get, Query, Req, Render } from '@nestjs/common';
import { Request } from 'express';
import { MenusViewService } from './menus-view.service';

@Controller('admin')
export class DashboardController {
  constructor(private readonly view: MenusViewService) {}

  @Get()
  @Render('admin/dashboard')
  async index(@Query('menu') menuId: string | undefined, @Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    return this.view.build(restaurantId, req.locale ?? 'ar', menuId);
  }
}
