import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { LocaleController } from './locale.controller';

@Module({
  controllers: [HomeController, LocaleController],
})
export class HomeModule {}
