import { Module } from '@nestjs/common';
import { GuestPosController } from './guest-pos.controller';
import { GuestPosService } from './guest-pos.service';
import { PosController } from './pos.controller';
import { PosEventBus } from './pos-event-bus';
import { PosGateway } from './pos.gateway';
import { PosService } from './pos.service';

@Module({
  controllers: [GuestPosController, PosController],
  providers: [GuestPosService, PosService, PosEventBus, PosGateway],
  exports: [GuestPosService],
})
export class PosModule {}
