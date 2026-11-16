import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Bell, CalendarDays, FileSpreadsheet, LogOut, Pencil, QrCode, ScrollText, UserRound, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { eventosPublicos } from '@/lib/api';
import { dataHoraLonga } from '@/lib/format';
import { apiAutenticada, chamarApi, COOKIE_ACESSO } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Meu portal', robots: { index: false } };
export const dynamic = 'force-dynamic';

interface Me {
  usuario: { perfis: string[]; ultimo_login_em: string | null };
  membro: { nome_completo: string; cpf_mascarado: string | null; email: string | null; telefone: string | null; cidade?: string | null; comunidade?: string | null; edicao_tlc?: string | null; igreja: { nome: string | null } } | null;
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

const ATALHOS = [
  { href: '/portal/admin/eventos', titulo: 'Eventos', texto: 'Criar, ver e cancelar eventos', icone: CalendarDays, perm: ['eventos:criar', 'eventos:participantes'] },
  { href: '/portal/admin/qrcode', titulo: 'QR Code', texto: 'QR da presença de cada evento', icone: QrCode, perm: ['eventos:criar', 'eventos:participantes'] },
  { href: '/portal/admin/membros', titulo: 'Cadastro', texto: 'Aprovar cadastros, cargos e senhas', icone: UserCheck, perm: ['usuarios:aprovar'] },
  { href: '/portal/admin/relatorios', titulo: 'Planilhas', texto: 'Eventos, presenças e frequência', icone: FileSpreadsheet, perm: ['eventos:exportar'] },
  { href: '/portal/admin/auditoria', titulo: 'Auditoria', texto: 'Quem fez o quê e quando', icone: ScrollText, perm: ['auditoria:ler'] },
];

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
  const admin = perms.some((p) => ['eventos:participantes', 'eventos:exportar', 'usuarios:aprovar', 'auditoria:ler'].includes(p));
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
        <section aria-labelledby="adm" className="mt-6">
          <h2 id="adm" className="mb-3 text-lg">Administração</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ATALHOS.filter((a) => a.perm.some((p) => perms.includes(p))).map((a) => (
              <Link key={a.href} href={a.href} className="cartao flex items-start gap-3 p-4 hover:bg-superficie">
                <a.icone size={24} className="mt-0.5 shrink-0 text-primaria" aria-hidden />
                <span><span className="block font-semibold text-primaria">{a.titulo}</span><span className="text-sm text-texto-apoio">{a.texto}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Link href="/portal/dados" aria-labelledby="dados" className="cartao block p-5 hover:bg-superficie focus-visible:outline focus-visible:outline-2">
          <h2 id="dados" className="mb-3 flex items-center gap-2 text-lg"><UserRound size={20} aria-hidden /> Meus dados</h2>
          <dl className="space-y-2 text-base">
            <Linha t="Nome" v={me.membro?.nome_completo} />
            <Linha t="CPF" v={me.membro?.cpf_mascarado} />
            <Linha t="E-mail" v={me.membro?.email} />
            <Linha t="Telefone" v={telTela(me.membro?.telefone)} />
            <Linha t="TLC" v={me.membro?.edicao_tlc} />
            <Linha t="Comunidade" v={me.membro?.comunidade} />
            <Linha t="Cidade" v={me.membro?.cidade} />
          </dl>
          <span className="mt-4 inline-flex items-center gap-1 font-semibold text-primaria underline"><Pencil size={16} aria-hidden /> Toque aqui para alterar seus dados</span>
        </Link>

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

/** "+5567999692487" -> "(67) 99969-2487" */
function telTela(v?: string | null) {
  const d = (v ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return v ?? null;
}

function Linha({ t, v }: { t: string; v?: string | null }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-semibold">{t}:</dt>
      <dd className="text-texto-apoio">{v || '—'}</dd>
    </div>
  );
}
