import { Module } from '@nestjs/common';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AvisosModule } from './avisos/avisos.module';
import { AuthModule } from './auth/auth.module';
import { CadastroModule } from './cadastro/cadastro.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EventosModule } from './eventos/eventos.module';
import { HealthModule } from './health/health.module';
import { SiteModule } from './site/site.module';

@Module({ imports: [ConfigModule, DatabaseModule, CommonModule, HealthModule, SiteModule, AuthModule, EventosModule, CadastroModule, AuditoriaModule, AvisosModule] })
export class AppModule {}
