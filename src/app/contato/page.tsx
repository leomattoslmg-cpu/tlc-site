import type { Metadata } from 'next';
import { ContatoForm } from '@/components/contato-form';

export const metadata: Metadata = { title: 'Contato' };

export default function Contato() {
  return (
    <section className="container-tlc max-w-2xl py-12">
      <h1 className="text-3xl sm:text-4xl">Fale com o TLC</h1>
      <div className="mt-2 h-1 w-16 rounded bg-destaque" aria-hidden />
      <p className="mb-8 mt-6 text-lg text-texto-apoio">Dúvidas, convites ou pedidos de oração e informação: escreva abaixo que a Secretaria responde.</p>
      <ContatoForm />
    </section>
  );
}
