import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_ACESSO, COOKIE_REFRESH } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/** Diz só se há sessão aberta (os cookies são httpOnly e o navegador não os lê). */
export async function GET() {
  const c = cookies();
  const logado = Boolean(c.get(COOKIE_ACESSO)?.value || c.get(COOKIE_REFRESH)?.value);
  return NextResponse.json({ logado }, { headers: { 'Cache-Control': 'no-store' } });
}
