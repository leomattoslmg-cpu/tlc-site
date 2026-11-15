import { Module } from '@nestjs/common';
import { CaptchaService } from './captcha.service';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';

@Module({ controllers: [SiteController], providers: [SiteService, CaptchaService] })
export class SiteModule {}
