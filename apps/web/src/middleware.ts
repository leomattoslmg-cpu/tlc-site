import { NextRequest, NextResponse } from 'next/server';

/**
 * Protege /portal/* e /presenca/*. Se o token de acesso (15 min) expirou mas o de renovação (30 dias) existe, renova sozinho.
 * Sem nenhum dos dois, manda para a tela de entrada.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/portal/entrar')) return NextResponse.next();

  if (req.cookies.get('tlc_acesso')?.value) return NextResponse.next();

  const refresh = req.cookies.get('tlc_refresh')?.value;
  if (refresh && API_URL) {
    try {
      const r = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
        signal: AbortSignal.timeout(20_000),
      });
      if (r.ok) {
        const t = (await r.json()) as { access_token: string; refresh_token: string; expira_em: number };
        const resp = NextResponse.redirect(req.nextUrl, 307);
        const base = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
        resp.cookies.set('tlc_acesso', t.access_token, { ...base, maxAge: t.expira_em });
        resp.cookies.set('tlc_refresh', t.refresh_token, { ...base, maxAge: 30 * 24 * 60 * 60 });
        return resp;
      }
    } catch {
      /* cai na tela de entrada */
    }
  }
  const destino = new URL('/portal/entrar', req.url);
  if (pathname.startsWith('/presenca/')) destino.searchParams.set('proximo', pathname);
  const resp = NextResponse.redirect(destino);
  resp.cookies.delete('tlc_refresh');
  return resp;
}

export const config = { matcher: ['/portal/:path*', '/presenca/:path*'] };
