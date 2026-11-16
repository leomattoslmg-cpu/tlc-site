import type { Metadata } from 'next';
import { AdminNav, SemAcesso } from '@/components/admin/admin-nav';
import { CancelarEvento, ExcluirEvento, Imprimir, TrocarQr } from '@/components/admin/acoes';
import { dataHoraLonga } from '@/lib/format';
import { Qr } from '@/lib/qr';
import { apiAutenticada, origemDoSite } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Evento', robots: { index: false } };
export const dynamic = 'force-dynamic';

interface Detalhe {
  evento: { id: string; nome: string; descricao: string | null; inicio_em: string; fim_em: string; local_nome: string | null; status: string; checkin_token: string };
  presencas: { membro_id: string; nome_completo: string; metodo: string; registrado_em: string }[];
}

const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Campo_Grande', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso));

export default async function EventoAdmin({ params }: { params: { id: string } }) {
  const d = await apiAutenticada<Detalhe>(`/eventos/${encodeURIComponent(params.id)}`);
  if (!d) {
    return (
      <div className="container-tlc py-8 sm:py-12">
        <AdminNav atual="/portal/admin/eventos" />
        <SemAcesso />
      </div>
    );
  }
  const e = d.evento;
  const url = `${await origemDoSite()}/presenca/${e.checkin_token}`;
  return (
    <div className="container-tlc py-8 sm:py-12">
      <AdminNav atual="/portal/admin/eventos" />
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="cartao flex flex-col items-center p-6 text-center">
          <h1 className="text-2xl">{e.nome}</h1>
          <p className="mt-1 text-texto-apoio">{dataHoraLonga(e.inicio_em)}{e.local_nome ? ` · ${e.local_nome}` : ''}</p>
          {e.status === 'cancelado' && <p className="mt-2 font-semibold text-cat-importante">Evento cancelado</p>}
          <div className="my-5"><Qr texto={url} tamanho={320} rotulo={`QR Code de presença: ${e.nome}`} /></div>
          <p className="text-lg font-semibold">Escaneie, entre com seu CPF e marque sua presença.</p>
          <p className="mt-1 break-all text-sm text-texto-apoio">{url}</p>
          <div className="nao-imprimir mt-5 flex flex-wrap justify-center gap-3">
            <Imprimir />
            {e.status !== 'cancelado' && <TrocarQr id={e.id} />}
            {e.status !== 'cancelado' && <CancelarEvento id={e.id} />}
            <ExcluirEvento id={e.id} presentes={d.presencas.length} depois="/portal/admin/eventos" />
          </div>
        </section>

        <section className="nao-imprimir" aria-labelledby="presentes">
          <h2 id="presentes" className="mb-3 text-lg">Presentes ({d.presencas.length})</h2>
          {d.presencas.length === 0 ? (
            <p className="text-texto-apoio">Ninguém marcou presença ainda. A marcação abre 2 horas antes do início.</p>
          ) : (
            <ul className="divide-y divide-borda">
              {d.presencas.map((p) => (
                <li key={p.membro_id} className="flex justify-between gap-3 py-2">
                  <span>{p.nome_completo}</span>
                  <span className="text-sm text-texto-apoio">{hora(p.registrado_em)} · {p.metodo === 'qr' ? 'QR' : 'manual'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
