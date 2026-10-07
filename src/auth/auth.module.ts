import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';
import { LoginRateLimiter } from './login-rate-limiter';

@Module({
  controllers: [AuthController, PasswordResetController],
  providers: [LoginRateLimiter, PasswordResetService],
  exports: [LoginRateLimiter, PasswordResetService],
})
export class AuthModule {}
