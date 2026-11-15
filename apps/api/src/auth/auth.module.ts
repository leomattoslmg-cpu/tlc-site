import { Module } from '@nestjs/common';
import { AuthController, MeController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { BootstrapService } from './bootstrap.service';
import { CryptoService } from './crypto.service';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, AuthGuard, CryptoService, BootstrapService],
  exports: [AuthService, AuthGuard, CryptoService],
})
export class AuthModule {}
