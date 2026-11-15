import { API_URL } from './site';

/** Cookies da sessão do portal. Ficam só no servidor (httpOnly): o JavaScript do navegador nunca vê os tokens. */
export const COOKIE_ACESSO = 'tlc_acesso';
export const COOKIE_REFRESH = 'tlc_refresh';

const EM_PRODUCAO = process.env.NODE_ENV === 'production';

export function opcoesCookie(maxAgeSegundos: number) {
  return { httpOnly: true, secure: EM_PRODUCAO, sameSite: 'lax' as const, path: '/', maxAge: maxAgeSegundos };
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expira_em: number;
}

export const REFRESH_SEGUNDOS = 30 * 24 * 60 * 60;

/** Chamada à API a partir do servidor do site. A primeira chamada pode demorar: a hospedagem gratuita "dorme". */
export async function chamarApi(caminho: string, init: RequestInit = {}, token?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${caminho}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(65_000) });
}

/** Chamada autenticada a partir de uma página do servidor. Devolve null se não houver sessão ou a API não responder. */
export async function apiAutenticada<T>(caminho: string): Promise<T | null> {
  const { cookies } = await import('next/headers');
  const token = cookies().get(COOKIE_ACESSO)?.value;
  if (!token) return null;
  try {
    const r = await chamarApi(caminho, {}, token);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Endereço do próprio site (para o QR Code apontar certo), tirado do pedido atual. */
export async function origemDoSite(): Promise<string> {
  const { headers } = await import('next/headers');
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3001';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
