import { Module } from '@nestjs/common';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';
import { SignupValidationFilter } from './signup-validation.filter';

@Module({
  imports: [ProvisioningModule],
  controllers: [SignupController],
  providers: [SignupService, SignupValidationFilter],
  exports: [SignupService],
})
export class SignupModule {}
