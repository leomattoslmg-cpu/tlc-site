import { NextRequest, NextResponse } from 'next/server';
import { chamarApi, COOKIE_ACESSO, COOKIE_REFRESH, opcoesCookie, REFRESH_SEGUNDOS, type Tokens } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/** Só estas áreas da API podem ser chamadas por aqui (nada de /auth). */
const PERMITIDOS = ['eventos', 'convites', 'membros', 'membros-pendentes', 'relatorios', 'presenca', 'me'];

async function repassar(req: NextRequest, { params }: { params: { caminho: string[] } }) {
  const [area] = params.caminho;
  if (!PERMITIDOS.includes(area)) return NextResponse.json({ mensagem: 'Não encontrado.' }, { status: 404 });

  // Mesma origem apenas (defesa contra pedidos vindos de outros sites).
  const origem = req.headers.get('origin');
  if (req.method !== 'GET' && origem && origem !== req.nextUrl.origin) return NextResponse.json({ mensagem: 'Origem não permitida.' }, { status: 403 });

  let acesso = req.cookies.get(COOKIE_ACESSO)?.value;
  let novos: Tokens | null = null;
  if (!acesso) {
    const refresh = req.cookies.get(COOKIE_REFRESH)?.value;
    if (refresh) {
      try {
        const r = await chamarApi('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: refresh }) });
        if (r.ok) {
          novos = (await r.json()) as Tokens;
          acesso = novos.access_token;
        }
      } catch {
        /* segue sem sessão */
      }
    }
  }
  if (!acesso) return NextResponse.json({ mensagem: 'Sua sessão terminou. Entre de novo.' }, { status: 401 });

  const caminho = `/${params.caminho.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;
  const corpo = req.method === 'GET' || req.method === 'DELETE' ? undefined : await req.text();
  let up: Response;
  try {
    up = await chamarApi(caminho, { method: req.method, body: corpo || undefined }, acesso);
  } catch {
    return NextResponse.json({ mensagem: 'O servidor demorou a responder. Tente de novo.' }, { status: 504 });
  }

  const headers = new Headers();
  for (const h of ['content-type', 'content-disposition']) {
    const v = up.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('Cache-Control', 'no-store');
  const resp = new NextResponse(up.status === 204 ? null : await up.arrayBuffer(), { status: up.status, headers });
  if (novos) {
    resp.cookies.set(COOKIE_ACESSO, novos.access_token, opcoesCookie(novos.expira_em));
    resp.cookies.set(COOKIE_REFRESH, novos.refresh_token, opcoesCookie(REFRESH_SEGUNDOS));
  }
  return resp;
}

export { repassar as GET, repassar as POST, repassar as DELETE };
