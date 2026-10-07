import { Module } from '@nestjs/common';
import { BillingNotifier } from './billing-notifier.service';
import { BillingScheduler } from './billing-scheduler';

@Module({
  providers: [BillingNotifier, BillingScheduler],
  exports: [BillingNotifier],
})
export class BillingNoticesModule {}
