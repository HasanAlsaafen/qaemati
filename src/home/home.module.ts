import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { LocaleController } from './locale.controller';
import { DemoController } from './demo.controller';

@Module({
  controllers: [HomeController, LocaleController, DemoController],
})
export class HomeModule {}
