import type { Metadata } from 'next';
import Link from 'next/link';
import { SenhaForm } from '@/components/senha-form';

export const metadata: Metadata = { title: 'Trocar minha senha', robots: { index: false } };

export default function Senha() {
  return (
    <section className="container-tlc grid py-10">
      <div className="cartao mx-auto w-full max-w-md p-6 sm:p-8">
        <h1 className="mb-5 text-2xl">Trocar minha senha</h1>
        <SenhaForm />
        <Link href="/portal" className="mt-5 inline-block font-semibold text-primaria underline">← Voltar ao meu portal</Link>
      </div>
    </section>
  );
}
