import { Inject, Injectable, Logger } from '@nestjs/common';
import { createECDH, hkdfSync } from 'node:crypto';
import * as webpush from 'web-push';
import { ENV, Env } from '../config/env';
import { DatabaseService } from '../database/database.service';

interface Vapid {
  publica: string;
  privada: string;
}

export interface Inscricao {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Notificações no celular (Web Push). As chaves VAPID saem do APP_SEGREDO (HKDF), então não há variável nova
 * para configurar: enquanto o segredo for o mesmo, a chave pública também é a mesma.
 */
@Injectable()
export class PushService {
  private readonly log = new Logger('Push');
  private vapid?: Vapid | null;

  constructor(
    private readonly db: DatabaseService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private chaves(): Vapid | null {
    if (this.vapid !== undefined) return this.vapid;
    const segredo = this.env.APP_SEGREDO;
    this.vapid = null;
    if (!segredo) return null;
    for (let i = 0; i < 8; i++) {
      const priv = Buffer.from(hkdfSync('sha256', segredo, 'tlc-v1', `vapid-${i}`, 32));
      try {
        const ecdh = createECDH('prime256v1');
        ecdh.setPrivateKey(priv);
        this.vapid = { publica: ecdh.getPublicKey().toString('base64url'), privada: priv.toString('base64url') };
        webpush.setVapidDetails('https://www.tlcpontapora.com.br', this.vapid.publica, this.vapid.privada);
        return this.vapid;
      } catch {
        /* escalar fora da curva (raríssimo): tenta o próximo */
      }
    }
    return null;
  }

  chavePublica(): string | null {
    return this.chaves()?.publica ?? null;
  }

  async inscrever(usuarioId: string, i: Inscricao, userAgent?: string): Promise<void> {
    await this.db.query(
      `INSERT INTO push_inscricoes (usuario_id, endpoint, p256dh, auth, user_agent) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
      [usuarioId, i.endpoint, i.p256dh, i.auth, userAgent?.slice(0, 300) ?? null],
    );
  }

  async cancelar(usuarioId: string, endpoint: string): Promise<void> {
    await this.db.query('DELETE FROM push_inscricoes WHERE usuario_id = $1 AND endpoint = $2', [usuarioId, endpoint]);
  }

  /** Manda um aviso a todos os aparelhos inscritos (ou só aos da coordenação). Nunca lança erro. */
  async avisar(o: { titulo: string; texto: string; url: string; soCoordenacao: boolean }): Promise<void> {
    try {
      if (!this.chaves()) return;
      const r = await this.db.query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
        `SELECT p.id, p.endpoint, p.p256dh, p.auth
           FROM push_inscricoes p JOIN usuarios u ON u.id = p.usuario_id
          WHERE u.status = 'ativo'
            AND ($1::boolean = false OR p.usuario_id IN (
                  SELECT up.usuario_id FROM usuario_perfis up
                    JOIN perfil_permissoes pp ON pp.perfil_id = up.perfil_id
                    JOIN permissoes pm ON pm.id = pp.permissao_id
                   WHERE pm.recurso || ':' || pm.acao = 'avisos:publicar'))`,
        [o.soCoordenacao],
      );
      const carga = JSON.stringify({ titulo: o.titulo.slice(0, 100), texto: o.texto.slice(0, 140), url: o.url });
      const mortos: string[] = [];
      for (let i = 0; i < r.rows.length; i += 20) {
        await Promise.all(
          r.rows.slice(i, i + 20).map(async (s) => {
            try {
              await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 86400 });
            } catch (e) {
              const st = (e as { statusCode?: number }).statusCode;
              if (st === 404 || st === 410) mortos.push(s.id);
              else this.log.warn(`Falha ao enviar (${st ?? 'sem status'})`);
            }
          }),
        );
      }
      if (mortos.length) await this.db.query('DELETE FROM push_inscricoes WHERE id = ANY($1::uuid[])', [mortos]);
    } catch (e) {
      this.log.warn(`Notificação não enviada: ${(e as Error).message}`);
    }
  }
}
