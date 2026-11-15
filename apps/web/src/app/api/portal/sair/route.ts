import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { chamarApi, COOKIE_ACESSO, COOKIE_REFRESH } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const token = cookies().get(COOKIE_ACESSO)?.value;
  if (token) {
    try {
      await chamarApi('/auth/logout', { method: 'POST' }, token);
    } catch {
      /* mesmo sem resposta da API, o cookie é apagado abaixo */
    }
  }
  const resp = NextResponse.redirect(new URL('/portal/entrar', req.url), 303);
  resp.cookies.delete(COOKIE_ACESSO);
  resp.cookies.delete(COOKIE_REFRESH);
  return resp;
}
