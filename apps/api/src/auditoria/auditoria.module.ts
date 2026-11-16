import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditoriaController } from './auditoria.controller';

@Module({ imports: [AuthModule], controllers: [AuditoriaController] })
export class AuditoriaModule {}
