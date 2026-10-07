import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditService } from './audit.service';
import { DashboardService } from './dashboard.service';
import { PaymentsService } from './payments.service';
import { PlansService } from './plans.service';
import { SuperAuthController } from './super-auth.controller';
import { SuperDashboardController } from './super-dashboard.controller';
import { SuperPaymentsController } from './super-payments.controller';
import { SuperPlansController } from './super-plans.controller';
import { SuperTenantsController } from './super-tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [AuthModule],
  controllers: [
    SuperAuthController,
    SuperDashboardController,
    SuperTenantsController,
    SuperPlansController,
    SuperPaymentsController,
  ],
  providers: [AuditService, PlansService, TenantsService, PaymentsService, DashboardService],
})
export class SuperAdminModule {}
