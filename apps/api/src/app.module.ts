import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { SiteModule } from './site/site.module';

@Module({ imports: [ConfigModule, DatabaseModule, CommonModule, HealthModule, SiteModule] })
export class AppModule {}
