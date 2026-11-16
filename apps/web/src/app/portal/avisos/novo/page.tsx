import type { Metadata } from 'next';
import Link from 'next/link';
import { AvisoForm } from '@/components/aviso-form';

export const metadata: Metadata = { title: 'Novo aviso', robots: { index: false } };

export default function NovoAviso() {
  return (
    <div className="container-tlc max-w-2xl py-8 sm:py-12">
      <Link href="/portal/avisos" className="mb-4 inline-block font-semibold text-primaria underline">← Avisos</Link>
      <div className="cartao p-6 sm:p-8">
        <h1 className="mb-5 text-2xl">Novo aviso</h1>
        <AvisoForm />
      </div>
    </div>
  );
}
