import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AvisoForm } from '@/components/aviso-form';
import type { Aviso } from '@/components/aviso-card';
import { apiAutenticada } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Editar aviso', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function EditarAviso({ params }: { params: { id: string } }) {
  const a = await apiAutenticada<Aviso & { pode_editar: boolean }>(`/avisos/${encodeURIComponent(params.id)}`);
  if (!a || !a.pode_editar) notFound();
  return (
    <div className="container-tlc max-w-2xl py-8 sm:py-12">
      <Link href="/portal/avisos" className="mb-4 inline-block font-semibold text-primaria underline">← Avisos</Link>
      <div className="cartao p-6 sm:p-8">
        <h1 className="mb-5 text-2xl">Editar aviso</h1>
        <AvisoForm id={a.id} inicial={{ titulo: a.titulo, conteudo: a.conteudo, categoria: a.categoria, publico_alvo: a.publico_alvo === 'todos' ? 'membros' : a.publico_alvo, fixado: a.fixado, status: a.status }} />
      </div>
    </div>
  );
}
