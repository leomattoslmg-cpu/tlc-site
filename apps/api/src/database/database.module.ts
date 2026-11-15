import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { AuditoriaService } from './auditoria.service';
import { OrganizacaoService } from './organizacao.service';

@Global()
@Module({ providers: [DatabaseService, OrganizacaoService, AuditoriaService], exports: [DatabaseService, OrganizacaoService, AuditoriaService] })
export class DatabaseModule {}
