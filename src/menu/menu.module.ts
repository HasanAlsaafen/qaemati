import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { AnalyticsService } from '../admin/analytics.service';

@Module({
  controllers: [MenuController],
  providers: [MenuService, AnalyticsService],
})
export class MenuModule {}
