import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Bell, CalendarDays, LogOut, QrCode, UserRound } from 'lucide-react';
import Link from 'next/link';
import { eventosPublicos } from '@/lib/api';
import { dataHoraLonga } from '@/lib/format';
import { apiAutenticada, chamarApi, COOKIE_ACESSO } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Meu portal', robots: { index: false } };
export const dynamic = 'force-dynamic';

interface Me {
  usuario: { perfis: string[]; ultimo_login_em: string | null };
  membro: { nome_completo: string; cpf_mascarado: string | null; email: string | null; telefone: string | null; igreja: { nome: string | null } } | null;
}

const ROTULO_PERFIL: Record<string, string> = {
  super_admin: 'Super Administrador',
  admin: 'Administrador',
  secretaria: 'Secretaria',
  coordenador: 'Coordenação',
  lider: 'Líder',
  membro: 'Membro',
  coordenador_geral: 'Coordenador(a) geral',
  coordenador_diocesano: 'Coordenador(a) diocesano',
  tesoureiro: 'Tesoureiro(a)',
  marketing: 'Marketing',
};

async function carregarMe(): Promise<Me | null> {
  const token = cookies().get(COOKIE_ACESSO)?.value;
  if (!token) return null;
  try {
    const r = await chamarApi('/me', {}, token);
    return r.ok ? ((await r.json()) as Me) : null;
  } catch {
    return null;
  }
}

export default async function Portal() {
  const me = await carregarMe();
  if (!me) redirect('/portal/entrar');
  const agora = Date.now();
  const perms = (await apiAutenticada<{ data: string[] }>('/me/permissoes'))?.data ?? [];
  const admin = perms.some((p) => ['eventos:participantes', 'eventos:exportar', 'usuarios:aprovar'].includes(p));
  const eventos = (await eventosPublicos()).filter((e) => new Date(e.fim_em).getTime() >= agora && e.status !== 'cancelado').slice(0, 3);
  const primeiro = me.membro?.nome_completo.split(' ')[0] ?? '';
  const perfis = me.usuario.perfis.map((p) => ROTULO_PERFIL[p] ?? p);

  return (
    <div className="container-tlc py-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl">Paz e bem, {primeiro}!</h1>
          <p className="mt-1 text-texto-apoio">{perfis.join(' · ')}</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/portal/dados" className="font-semibold text-primaria underline">Atualizar meus dados</Link>
            <Link href="/portal/senha" className="font-semibold text-primaria underline">Trocar minha senha</Link>
          </div>
        </div>
        <form action="/api/portal/sair" method="post">
          <button type="submit" className="btn-secundario min-h-[44px] gap-2 px-4">
            <LogOut size={18} aria-hidden /> Sair
          </button>
        </form>
      </div>

      {admin && (
        <Link href="/portal/admin/eventos" className="cartao mt-6 flex items-center gap-3 p-4 font-semibold text-primaria hover:bg-superficie">
          <QrCode size={22} aria-hidden /> Administração: eventos, QR Codes, cadastros e planilhas
        </Link>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="cartao p-5" aria-labelledby="dados">
          <h2 id="dados" className="mb-3 flex items-center gap-2 text-lg"><UserRound size={20} aria-hidden /> Meus dados</h2>
          <dl className="space-y-2 text-base">
            <Linha t="Nome" v={me.membro?.nome_completo} />
            <Linha t="CPF" v={me.membro?.cpf_mascarado} />
            <Linha t="E-mail" v={me.membro?.email} />
            <Linha t="Telefone" v={me.membro?.telefone} />
            <Linha t="Igreja" v={me.membro?.igreja.nome} />
          </dl>
          <Link href="/portal/dados" className="mt-4 inline-block font-semibold text-primaria underline">Atualizar meus dados</Link>
        </section>

        <section className="cartao p-5" aria-labelledby="avisos">
          <h2 id="avisos" className="mb-3 flex items-center gap-2 text-lg"><Bell size={20} aria-hidden /> Avisos</h2>
          <p className="text-texto-apoio">Os avisos da coordenação vão aparecer aqui em breve.</p>
        </section>

        <section className="cartao p-5 md:col-span-2" aria-labelledby="eventos">
          <h2 id="eventos" className="mb-3 flex items-center gap-2 text-lg"><CalendarDays size={20} aria-hidden /> Próximos eventos</h2>
          {eventos.length === 0 ? (
            <p className="text-texto-apoio">Nenhum evento marcado por enquanto.</p>
          ) : (
            <ul className="divide-y divide-borda">
              {eventos.map((e) => (
                <li key={e.id} className="py-3">
                  <p className="font-semibold">{e.nome}</p>
                  <p className="text-sm text-texto-apoio">{dataHoraLonga(e.inicio_em)}{e.local_nome ? ` · ${e.local_nome}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/eventos" className="mt-3 inline-block font-semibold text-primaria underline">Ver todos os eventos</Link>
        </section>
      </div>
    </div>
  );
}

function Linha({ t, v }: { t: string; v?: string | null }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-semibold">{t}:</dt>
      <dd className="text-texto-apoio">{v || '—'}</dd>
    </div>
  );
}
