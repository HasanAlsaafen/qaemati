import { Module } from '@nestjs/common';
import { PairingsController } from './pairings.controller';
import { PairingsService } from './pairings.service';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';

@Module({
  controllers: [SuggestionsController, PairingsController],
  providers: [SuggestionsService, PairingsService],
})
export class SuggestionsModule {}
