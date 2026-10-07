import { Module } from '@nestjs/common';
import { TenantProvisioner } from './tenant-provisioner.service';

@Module({ providers: [TenantProvisioner], exports: [TenantProvisioner] })
export class ProvisioningModule {}
