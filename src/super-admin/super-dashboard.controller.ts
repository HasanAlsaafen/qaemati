import { Controller, Get, Render } from '@nestjs/common';
import { AuditService } from './audit.service';
import { DashboardService } from './dashboard.service';

@Controller('super')
export class SuperDashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Render('super/dashboard')
  async index() {
    return { summary: await this.dashboard.summary() };
  }

  @Get('audit')
  @Render('super/audit')
  async auditLog() {
    return { entries: await this.audit.list({ take: 200 }) };
  }
}
