import { Module } from '@nestjs/common';
import { AuthController, MeController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PermissaoGuard } from './permissao.guard';
import { BootstrapService } from './bootstrap.service';
import { CryptoService } from './crypto.service';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, AuthGuard, PermissaoGuard, CryptoService, BootstrapService],
  exports: [AuthService, AuthGuard, PermissaoGuard, CryptoService],
})
export class AuthModule {}
