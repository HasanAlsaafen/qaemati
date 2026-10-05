import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { CategoriesController } from './categories.controller';
import { ItemsController } from './items.controller';
import { QrController } from './qr.controller';
import { BrandingController } from './branding.controller';
import { TourController } from './tour.controller';
import { AnalyticsController } from './analytics.controller';
import { CategoryService } from './category.service';
import { ItemService } from './item.service';
import { TableService } from './table.service';
import { RestaurantService } from './restaurant.service';
import { AnalyticsService } from './analytics.service';

@Module({
  controllers: [
    DashboardController,
    CategoriesController,
    ItemsController,
    QrController,
    BrandingController,
    TourController,
    AnalyticsController,
  ],
  providers: [CategoryService, ItemService, TableService, RestaurantService, AnalyticsService],
})
export class AdminModule {}
