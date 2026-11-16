import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { AvisoCard, type Aviso } from '@/components/aviso-card';
import { apiAutenticada } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Avisos', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function Avisos() {
  const r = await apiAutenticada<{ data: Aviso[]; pode_editar: boolean }>('/avisos');
  return (
    <div className="container-tlc max-w-3xl py-8 sm:py-12">
      <Link href="/portal" className="mb-4 inline-block font-semibold text-primaria underline">← Meu portal</Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Avisos</h1>
        {r?.pode_editar && (
          <Link href="/portal/avisos/novo" className="btn-primario gap-2"><Plus size={18} aria-hidden /> Novo aviso</Link>
        )}
      </div>
      {!r ? (
        <p role="alert">Não foi possível carregar os avisos agora. Tente de novo em instantes.</p>
      ) : r.data.length === 0 ? (
        <div className="cartao p-8 text-center text-texto-apoio">Nenhum aviso por enquanto. Quando a coordenação publicar, aparece aqui.</div>
      ) : (
        <div className="space-y-5">
          {r.data.map((a) => (
            <AvisoCard
              key={a.id}
              aviso={a}
              acao={r.pode_editar ? <Link href={`/portal/avisos/${a.id}/editar`} className="inline-flex items-center gap-1.5 font-semibold text-primaria underline"><Pencil size={16} aria-hidden /> Editar aviso</Link> : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
