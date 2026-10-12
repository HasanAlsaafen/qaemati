import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import { BillingNoticesModule } from '../billing-notices/billing-notices.module';
import { AuditService } from './audit.service';
import { DashboardService } from './dashboard.service';
import { PaymentsService } from './payments.service';
import { PlansService } from './plans.service';
import { PlatformReportsService } from './platform-reports.service';
import { SuperReportsController } from './super-reports.controller';
import { SuperAuthController } from './super-auth.controller';
import { SuperPasswordResetController } from './super-password-reset.controller';
import { SuperSecurityController } from './super-security.controller';
import { TwoFactorService } from './two-factor.service';
import { SuperDashboardController } from './super-dashboard.controller';
import { SuperPaymentsController } from './super-payments.controller';
import { SuperPlansController } from './super-plans.controller';
import { SuperThemesController } from './super-themes.controller';
import { ThemesAdminService } from './themes-admin.service';
import { SuperTenantsController } from './super-tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [AuthModule, BillingNoticesModule, ProvisioningModule],
  controllers: [
    SuperAuthController,
    SuperReportsController,
    SuperPasswordResetController,
    SuperSecurityController,
    SuperDashboardController,
    SuperTenantsController,
    SuperPlansController,
    SuperThemesController,
    SuperPaymentsController,
  ],
  providers: [
    PlatformReportsService,
    TwoFactorService,
    AuditService,
    PlansService,
    ThemesAdminService,
    TenantsService,
    PaymentsService,
    DashboardService,
  ],
})
export class SuperAdminModule {}
