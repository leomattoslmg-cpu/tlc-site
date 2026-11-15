import { NextResponse } from 'next/server';
import { chamarApi, COOKIE_ACESSO, COOKIE_REFRESH, opcoesCookie, REFRESH_SEGUNDOS, type Tokens } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let corpo: { cpf?: string; senha?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ mensagem: 'Pedido inválido.' }, { status: 400 });
  }
  try {
    const r = await chamarApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ cpf: corpo.cpf ?? '', senha: corpo.senha ?? '', dispositivo: { plataforma: 'web' } }),
    });
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) {
      const campo = Array.isArray(dados.errors) ? dados.errors[0]?.message : undefined;
      const mensagem = r.status === 401 ? 'CPF ou senha incorretos.' : campo || dados.detail || dados.title || 'Não foi possível entrar.';
      const resp = NextResponse.json({ mensagem }, { status: r.status === 401 ? 401 : r.status });
      const espera = r.headers.get('retry-after');
      if (espera) resp.headers.set('Retry-After', espera);
      return resp;
    }
    const t = dados as Tokens;
    const resp = NextResponse.json({ ok: true });
    resp.cookies.set(COOKIE_ACESSO, t.access_token, opcoesCookie(t.expira_em));
    resp.cookies.set(COOKIE_REFRESH, t.refresh_token, opcoesCookie(REFRESH_SEGUNDOS));
    return resp;
  } catch {
    return NextResponse.json({ mensagem: 'O servidor demorou a responder. Espere um minuto e tente de novo.' }, { status: 504 });
  }
}
