import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { CategoriesController } from './categories.controller';
import { ItemsController } from './items.controller';
import { QrController } from './qr.controller';
import { BrandingController } from './branding.controller';
import { TourController } from './tour.controller';
import { AnalyticsController } from './analytics.controller';
import { BulkController } from './bulk.controller';
import { MenusController } from './menus.controller';
import { BillingController } from './billing.controller';
import { MenusService } from './menus.service';
import { MenusViewService } from './menus-view.service';
import { CategoryService } from './category.service';
import { ItemService } from './item.service';
import { TableService } from './table.service';
import { RestaurantService } from './restaurant.service';
import { AnalyticsService } from './analytics.service';
import { BulkService } from './bulk.service';

@Module({
  controllers: [
    DashboardController,
    CategoriesController,
    ItemsController,
    QrController,
    BrandingController,
    TourController,
    AnalyticsController,
    BulkController,
    MenusController,
    BillingController,
  ],
  providers: [
    CategoryService,
    ItemService,
    TableService,
    RestaurantService,
    AnalyticsService,
    BulkService,
    MenusService,
    MenusViewService,
  ],
})
export class AdminModule {}
