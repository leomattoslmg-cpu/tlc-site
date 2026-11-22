import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PainelController } from './painel.controller';
import { PainelService } from './painel.service';

@Module({ imports: [AuthModule], controllers: [PainelController], providers: [PainelService] })
export class PainelModule {}
