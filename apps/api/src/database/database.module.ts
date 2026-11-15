import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { OrganizacaoService } from './organizacao.service';

@Global()
@Module({ providers: [DatabaseService, OrganizacaoService], exports: [DatabaseService, OrganizacaoService] })
export class DatabaseModule {}
