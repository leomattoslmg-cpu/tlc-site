import type { Metadata } from 'next';
import { AdminNav, SemAcesso } from '@/components/admin/admin-nav';
import { AprovarMembro, NovoConvite, RecusarMembro, RedefinirSenha, RevogarConvite } from '@/components/admin/acoes';
import { Qr } from '@/lib/qr';
import { apiAutenticada, origemDoSite } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Membros e QR de cadastro', robots: { index: false } };
export const dynamic = 'force-dynamic';

interface Pendente { id: string; nome_completo: string; cpf_mascarado: string | null; email: string | null; telefone: string | null; edicao_tlc: string | null; comunidade: string | null; cidade: string | null }
interface Membro { id: string; nome_completo: string; cpf_mascarado: string | null; telefone: string | null; edicao_tlc: string | null; comunidade: string | null; cidade: string | null; status: string }
interface Convite { id: string; token: string; expira_em: string; max_usos: number | null; usos: number; ativo: boolean }

const dia = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Campo_Grande', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

export default async function Membros({ searchParams }: { searchParams: { q?: string } }) {
  const q = typeof searchParams.q === 'string' ? searchParams.q.slice(0, 80) : '';
  const [pend, conv, lista] = await Promise.all([
    apiAutenticada<{ data: Pendente[] }>('/membros-pendentes'),
    apiAutenticada<{ data: Convite[] }>('/convites'),
    apiAutenticada<{ data: Membro[] }>(`/membros?q=${encodeURIComponent(q)}`),
  ]);
  if (!pend || !conv) {
    return (
      <div className="container-tlc py-8 sm:py-12">
        <AdminNav atual="/portal/admin/membros" />
        <SemAcesso />
      </div>
    );
  }
  const origem = await origemDoSite();
  const ativos = conv.data.filter((c) => c.ativo);
  return (
    <div className="container-tlc py-8 sm:py-12">
      <AdminNav atual="/portal/admin/membros" />
      <section aria-labelledby="pend" className="mb-10">
        <h2 id="pend" className="mb-3 text-lg">Cadastros aguardando aprovação ({pend.data.length})</h2>
        {pend.data.length === 0 ? (
          <p className="text-texto-apoio">Nenhum cadastro pendente.</p>
        ) : (
          <ul className="space-y-3">
            {pend.data.map((m) => (
              <li key={m.id} className="cartao flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{m.nome_completo}</p>
                  <p className="text-sm text-texto-apoio">CPF {m.cpf_mascarado} · {m.telefone} · {m.email}</p>
                  <p className="text-sm font-semibold">TLC: {m.edicao_tlc || '—'} · Comunidade: {m.comunidade || '—'} · Cidade: {m.cidade || '—'}</p>
                </div>
                <div className="flex gap-2"><AprovarMembro id={m.id} /><RecusarMembro id={m.id} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <NovoConvite />
        <section aria-labelledby="qrs">
          <h2 id="qrs" className="mb-3 text-lg">QR Codes de cadastro ativos</h2>
          {ativos.length === 0 ? (
            <p className="text-texto-apoio">Nenhum ativo. Gere um ao lado e mostre ou imprima para quem vai se cadastrar.</p>
          ) : (
            <ul className="space-y-4">
              {ativos.map((c) => (
                <li key={c.id} className="cartao flex flex-wrap items-center gap-4 p-4">
                  <Qr texto={`${origem}/cadastro/${c.token}`} tamanho={160} rotulo="QR Code de cadastro de membro" />
                  <div className="space-y-2">
                    <p className="text-sm text-texto-apoio">Vale até {dia(c.expira_em)}<br />{c.usos} cadastro(s){c.max_usos ? ` de ${c.max_usos}` : ''}</p>
                    <p className="max-w-[220px] break-all text-xs text-texto-apoio">{origem}/cadastro/{c.token}</p>
                    <RevogarConvite id={c.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="todos" className="mt-12">
        <h2 id="todos" className="mb-3 text-lg">Membros</h2>
        <form method="get" className="mb-4 flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="busca" className="mb-1 block font-semibold">Buscar pelo nome</label>
            <input id="busca" name="q" defaultValue={q} className="campo" />
          </div>
          <button type="submit" className="btn-secundario min-h-[48px] px-4">Buscar</button>
        </form>
        {!lista ? (
          <p className="text-texto-apoio">Você não tem acesso à lista de membros.</p>
        ) : lista.data.length === 0 ? (
          <p className="text-texto-apoio">Nenhum membro encontrado.</p>
        ) : (
          <ul className="space-y-3">
            {lista.data.map((m) => (
              <li key={m.id} className="cartao flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{m.nome_completo}</p>
                  <p className="text-sm text-texto-apoio">CPF {m.cpf_mascarado} · {m.telefone} · {m.edicao_tlc || 'TLC não informado'} · {m.comunidade || 'sem comunidade'} · {m.cidade || 'sem cidade'} · {m.status}</p>
                </div>
                <RedefinirSenha id={m.id} nome={m.nome_completo} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
