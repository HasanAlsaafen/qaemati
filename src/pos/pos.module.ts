import { Module } from '@nestjs/common';
import { GuestPosController } from './guest-pos.controller';
import { GuestPosService } from './guest-pos.service';
import { PosController } from './pos.controller';
import { PosEventBus } from './pos-event-bus';
import { PosGateway } from './pos.gateway';
import { PosService } from './pos.service';
import { TablesService } from './tables.service';
import { TableSessionService } from './table-session.service';
import { TrackGateway } from './track.gateway';

@Module({
  controllers: [GuestPosController, PosController],
  providers: [
    GuestPosService,
    PosService,
    TablesService,
    TableSessionService,
    PosEventBus,
    PosGateway,
    TrackGateway,
  ],
  exports: [GuestPosService, PosService],
})
export class PosModule {}
