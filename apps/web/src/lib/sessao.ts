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
