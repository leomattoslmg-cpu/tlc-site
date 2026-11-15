import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CaptchaService } from '../site/captcha.service';
import { CadastroAdminController, CadastroPublicoController } from './cadastro.controller';
import { CadastroService } from './cadastro.service';

@Module({
  imports: [AuthModule],
  controllers: [CadastroPublicoController, CadastroAdminController],
  providers: [CadastroService, CaptchaService],
})
export class CadastroModule {}
