import { Module } from '@nestjs/common';
import { StyleguideController } from './styleguide.controller';

@Module({
  controllers: [StyleguideController],
})
export class StyleguideModule {}
