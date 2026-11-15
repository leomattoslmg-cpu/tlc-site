import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav, SemAcesso } from '@/components/admin/admin-nav';
import { NovoEventoForm } from '@/components/admin/novo-evento-form';
import { dataHoraLonga } from '@/lib/format';
import { apiAutenticada } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Eventos e presença', robots: { index: false } };
export const dynamic = 'force-dynamic';

interface Ev { id: string; nome: string; inicio_em: string; local_nome: string | null; status: string; presentes: number }

export default async function Eventos() {
  const r = await apiAutenticada<{ data: Ev[] }>('/eventos');
  return (
    <div className="container-tlc py-8 sm:py-12">
      <AdminNav atual="/portal/admin/eventos" />
      {!r ? (
        <SemAcesso />
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <NovoEventoForm />
          <section aria-labelledby="lista">
            <h2 id="lista" className="mb-3 text-lg">Eventos cadastrados</h2>
            {r.data.length === 0 ? (
              <p className="text-texto-apoio">Nenhum evento ainda. Crie o primeiro ao lado.</p>
            ) : (
              <ul className="space-y-3">
                {r.data.map((e) => (
                  <li key={e.id} className="cartao p-4">
                    <Link href={`/portal/admin/eventos/${e.id}`} className="text-lg font-semibold text-primaria underline">{e.nome}</Link>
                    <p className="text-sm text-texto-apoio">{dataHoraLonga(e.inicio_em)}{e.local_nome ? ` · ${e.local_nome}` : ''}</p>
                    <p className="mt-1 text-sm">{e.status === 'cancelado' ? 'Cancelado' : `${e.presentes} presente(s)`}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
