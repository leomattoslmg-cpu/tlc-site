import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AvisosController } from './avisos.controller';
import { AvisosService } from './avisos.service';

@Module({ imports: [AuthModule], controllers: [AvisosController], providers: [AvisosService] })
export class AvisosModule {}
