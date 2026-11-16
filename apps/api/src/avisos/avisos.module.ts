import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { AvisosController } from './avisos.controller';
import { AvisosService } from './avisos.service';

@Module({ imports: [AuthModule, PushModule], controllers: [AvisosController], providers: [AvisosService] })
export class AvisosModule {}
