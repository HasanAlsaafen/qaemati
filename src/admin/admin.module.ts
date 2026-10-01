import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { CategoriesController } from './categories.controller';
import { ItemsController } from './items.controller';
import { CategoryService } from './category.service';
import { ItemService } from './item.service';

@Module({
  controllers: [DashboardController, CategoriesController, ItemsController],
  providers: [CategoryService, ItemService],
})
export class AdminModule {}
