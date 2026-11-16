import type { Metadata } from 'next';
import { AdminNav, SemAcesso } from '@/components/admin/admin-nav';
import { apiAutenticada } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Auditoria', robots: { index: false } };
export const dynamic = 'force-dynamic';

interface Reg { id: string; acao: string; entidade: string; depois: Record<string, unknown> | null; ip: string | null; criado_em: string; quem: string }

const ACOES: Record<string, string> = {
  'evento.criar': 'Criou um evento',
  'evento.cancelar': 'Cancelou um evento',
  'evento.trocar_qr': 'Trocou o QR Code de um evento',
  'evento.presenca': 'Presença marcada',
  'relatorio.exportar': 'Baixou uma planilha',
  'convite.criar': 'Criou um convite de cadastro',
  'convite.revogar': 'Revogou um convite de cadastro',
  'aviso.criar': 'Publicou um aviso',
  'aviso.editar': 'Editou um aviso',
  'aviso.arquivar': 'Arquivou um aviso',
  'membro.autocadastro': 'Novo cadastro recebido',
  'membro.aprovar': 'Aprovou um cadastro',
  'membro.recusar': 'Recusou um cadastro',
  'membro.atualizar_dados': 'Atualizou os próprios dados',
  'usuario.redefinir_senha': 'Redefiniu a senha de alguém',
  'usuario.cargo_dado': 'Deu um cargo',
  'usuario.cargo_retirado': 'Tirou um cargo',
};

const quando = (iso: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Campo_Grande' }).format(new Date(iso));

export default async function Auditoria({ searchParams }: { searchParams: { q?: string } }) {
  const q = typeof searchParams.q === 'string' ? searchParams.q.slice(0, 40) : '';
  const r = await apiAutenticada<{ data: Reg[] }>(`/auditoria?q=${encodeURIComponent(q)}`);
  return (
    <div className="container-tlc py-8 sm:py-12">
      <AdminNav atual="/portal/admin/auditoria" />
      {!r ? (
        <SemAcesso />
      ) : (
        <>
          <h1 className="mb-1 text-2xl">Auditoria</h1>
          <p className="mb-5 text-texto-apoio">Os 200 registros mais recentes. Ninguém consegue apagar nem alterar esta lista.</p>
          <form method="get" className="mb-5 flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="q" className="mb-1 block font-semibold">Filtrar pelo código da ação</label>
              <input id="q" name="q" defaultValue={q} placeholder="ex.: evento, usuario, membro" className="campo" />
            </div>
            <button type="submit" className="btn-secundario min-h-[48px] px-4">Filtrar</button>
          </form>
          {r.data.length === 0 ? (
            <p className="text-texto-apoio">Nenhum registro encontrado.</p>
          ) : (
            <ul className="space-y-3">
              {r.data.map((a) => {
                const det = a.depois ? Object.entries(a.depois).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ') : '';
                return (
                  <li key={a.id} className="cartao p-4">
                    <p className="font-semibold">{ACOES[a.acao] ?? a.acao}</p>
                    <p className="text-sm text-texto-apoio">{a.quem} · {quando(a.criado_em)}{a.ip ? ` · IP ${a.ip}` : ''}</p>
                    {det && <p className="mt-1 break-words text-sm">{det.slice(0, 300)}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
