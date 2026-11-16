import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Bell, CalendarDays, ChevronRight, FileSpreadsheet, KeyRound, LogOut, Pencil, Pin, Plus, QrCode, ScrollText, Smartphone, UserCheck, UserRound } from 'lucide-react';
import { NotificacaoBotao } from '@/components/notificacao-botao';
import { Chip, dataCurta, type Aviso } from '@/components/aviso-card';
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

  const avisos = (await apiAutenticada<{ data: Aviso[]; pode_editar: boolean }>('/avisos')) ?? { data: [], pode_editar: false };
  const recentes = avisos.data.filter((a) => a.status === 'publicado').slice(0, 3);

  return (
    <div className="container-tlc py-6 sm:py-10">
      <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-faixa via-faixa to-[#0B2A4A] px-6 py-9 text-white shadow-cartao sm:px-12 sm:py-14">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-destaque/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-white/5 blur-3xl" aria-hidden />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-destaque sm:text-sm">Treinamento de Liderança Cristã</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">TLCista, sua força irradia.</h1>
          <p className="mt-3 text-xl text-white/90 sm:text-2xl">Seja bem-vindo, <strong className="font-bold text-white">{primeiro}</strong></p>
          <div className="mt-5 flex flex-wrap gap-2">
            {perfis.map((p) => (
              <span key={p} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-semibold text-white">{p}</span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/portal/dados" className="inline-flex min-h-[44px] items-center gap-2 rounded-cartao bg-white/10 px-4 font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/20"><Pencil size={16} aria-hidden /> Atualizar meus dados</Link>
            <Link href="/portal/senha" className="inline-flex min-h-[44px] items-center gap-2 rounded-cartao bg-white/10 px-4 font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/20"><KeyRound size={16} aria-hidden /> Trocar minha senha</Link>
            <Link href="/instalar" className="inline-flex min-h-[44px] items-center gap-2 rounded-cartao bg-white/10 px-4 font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/20"><Smartphone size={16} aria-hidden /> Instalar o app</Link>
            <form action="/api/portal/sair" method="post">
              <button type="submit" className="inline-flex min-h-[44px] items-center gap-2 rounded-cartao px-4 font-semibold text-white/90 ring-1 ring-white/25 transition hover:bg-white/10"><LogOut size={16} aria-hidden /> Sair</button>
            </form>
          </div>
        </div>
      </header>

      <NotificacaoBotao />

      {admin && (
        <section aria-labelledby="adm" className="mt-10">
          <h2 id="adm" className="mb-4 text-xl font-bold">Administração</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ATALHOS.filter((a) => a.perm.some((p) => perms.includes(p))).map((a) => (
              <Link key={a.href} href={a.href} className="cartao group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-primaria hover:shadow-lg">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primaria/10 text-primaria transition group-hover:bg-primaria group-hover:text-primaria-sobre"><a.icone size={24} aria-hidden /></span>
                <span className="flex-1"><span className="block text-lg font-bold">{a.titulo}</span><span className="text-sm text-texto-apoio">{a.texto}</span></span>
                <ChevronRight size={20} className="text-texto-apoio transition group-hover:translate-x-0.5 group-hover:text-primaria" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="cartao flex flex-col p-6" aria-labelledby="avisos">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="avisos" className="flex items-center gap-3 text-xl font-bold"><Icone><Bell size={20} aria-hidden /></Icone> Avisos</h2>
            {avisos.pode_editar && (
              <Link href="/portal/avisos/novo" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-cartao bg-primaria px-3 text-sm font-semibold text-primaria-sobre hover:bg-primaria-forte"><Plus size={16} aria-hidden /> Novo</Link>
            )}
          </div>
          {recentes.length === 0 ? (
            <p className="text-texto-apoio">Nenhum aviso por enquanto. Quando a coordenação publicar, aparece aqui.</p>
          ) : (
            <ul className="space-y-3">
              {recentes.map((a) => (
                <li key={a.id}>
                  <Link href="/portal/avisos" className="block rounded-cartao border border-borda p-4 transition hover:border-primaria hover:bg-superficie">
                    <span className="mb-1.5 flex items-center gap-2"><Chip aviso={a} />{a.fixado && <Pin size={14} className="text-destaque" aria-label="Fixado" />}</span>
                    <span className="block font-bold leading-snug">{a.titulo}</span>
                    <span className="mt-0.5 block text-sm text-texto-apoio">{dataCurta(a.criado_em)} · {a.autor}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/portal/avisos" className="mt-auto inline-flex items-center gap-1 pt-5 font-semibold text-primaria hover:underline">Ver todos os avisos <ChevronRight size={18} aria-hidden /></Link>
        </section>

        <Link href="/portal/dados" aria-labelledby="dados" className="cartao group block p-6 transition hover:border-primaria hover:shadow-lg">
          <h2 id="dados" className="mb-4 flex items-center gap-3 text-xl font-bold"><Icone><UserRound size={20} aria-hidden /></Icone> Meus dados</h2>
          <dl className="space-y-2.5">
            <Linha t="Nome" v={me.membro?.nome_completo} />
            <Linha t="CPF" v={me.membro?.cpf_mascarado} />
            <Linha t="E-mail" v={me.membro?.email} />
            <Linha t="Telefone" v={telTela(me.membro?.telefone)} />
            <Linha t="TLC" v={me.membro?.edicao_tlc} />
            <Linha t="Comunidade" v={me.membro?.comunidade} />
            <Linha t="Cidade" v={me.membro?.cidade} />
          </dl>
          <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-primaria group-hover:underline"><Pencil size={16} aria-hidden /> Toque aqui para alterar seus dados</span>
        </Link>

        <section className="cartao p-6 lg:col-span-2" aria-labelledby="eventos">
          <h2 id="eventos" className="mb-4 flex items-center gap-3 text-xl font-bold"><Icone><CalendarDays size={20} aria-hidden /></Icone> Próximos eventos</h2>
          {eventos.length === 0 ? (
            <p className="text-texto-apoio">Nenhum evento marcado por enquanto.</p>
          ) : (
            <ul className="divide-y divide-borda">
              {eventos.map((e) => (
                <li key={e.id} className="py-3">
                  <p className="font-bold">{e.nome}</p>
                  <p className="text-sm text-texto-apoio">{dataHoraLonga(e.inicio_em)}{e.local_nome ? ` · ${e.local_nome}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/eventos" className="mt-4 inline-flex items-center gap-1 font-semibold text-primaria hover:underline">Ver todos os eventos <ChevronRight size={18} aria-hidden /></Link>
        </section>
      </div>
    </div>
  );
}

function Icone({ children }: { children: React.ReactNode }) {
  return <span className="grid h-10 w-10 place-items-center rounded-full bg-primaria/10 text-primaria">{children}</span>;
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
