import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BillingNotifier } from './billing-notifier.service';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Checks for due reminders an hour after start and then every hour. Running on
 * every server is fine: a reminder is claimed in the database before it is sent,
 * so it goes out once. Off in tests, and off with REMINDERS_ENABLED=false.
 */
@Injectable()
export class BillingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingScheduler.name);
  private first: NodeJS.Timeout | null = null;
  private every: NodeJS.Timeout | null = null;

  constructor(private readonly notifier: BillingNotifier) {}

  static enabled(): boolean {
    if (process.env.REMINDERS_ENABLED === 'false') return false;
    return process.env.NODE_ENV !== 'test' || process.env.REMINDERS_ENABLED === 'true';
  }

  onModuleInit(): void {
    if (!BillingScheduler.enabled()) return;
    const run = () =>
      this.notifier
        .runReminders()
        .catch((error) => this.logger.error(`Reminder run failed: ${error}`));
    this.first = setTimeout(run, 60_000);
    this.every = setInterval(run, HOUR_MS);
    this.first.unref();
    this.every.unref();
  }

  onModuleDestroy(): void {
    if (this.first) clearTimeout(this.first);
    if (this.every) clearInterval(this.every);
  }
}
