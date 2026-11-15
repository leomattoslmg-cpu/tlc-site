import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventosController, PresencaController, RelatoriosController } from './eventos.controller';
import { EventosService } from './eventos.service';
import { RelatoriosService } from './relatorios.service';

@Module({
  imports: [AuthModule],
  controllers: [EventosController, PresencaController, RelatoriosController],
  providers: [EventosService, RelatoriosService],
})
export class EventosModule {}
