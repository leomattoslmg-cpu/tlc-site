import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, Env } from '../config/env';

/** Confere o token do Cloudflare Turnstile enviado pelo formulário de contato. */
@Injectable()
export class CaptchaService {
  private readonly log = new Logger('Captcha');

  constructor(@Inject(ENV) private readonly env: Env) {}

  async verificar(token: string, ip?: string): Promise<boolean> {
    if (!this.env.TURNSTILE_SECRET) {
      // Fora de produção o captcha é dispensado; em produção, sem segredo, nada passa.
      if (this.env.NODE_ENV === 'production') this.log.error('TURNSTILE_SECRET ausente em produção');
      return this.env.NODE_ENV !== 'production';
    }
    try {
      const corpo = new URLSearchParams({ secret: this.env.TURNSTILE_SECRET, response: token });
      if (ip) corpo.set('remoteip', ip);
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: corpo,
        signal: AbortSignal.timeout(5000),
      });
      const j = (await r.json()) as { success?: boolean };
      return j.success === true;
    } catch (e) {
      this.log.warn(`Falha ao consultar o Turnstile: ${(e as Error).message}`);
      return false;
    }
  }
}
