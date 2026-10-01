import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { LoginRateLimiter } from './login-rate-limiter';

@Module({
  controllers: [AuthController],
  providers: [LoginRateLimiter],
  exports: [LoginRateLimiter],
})
export class AuthModule {}
