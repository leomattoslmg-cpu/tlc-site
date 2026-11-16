import type { Metadata } from 'next';
import Link from 'next/link';
import { CadastroForm } from '@/components/cadastro-form';
import { Guadalupe } from '@/components/guadalupe';

export const metadata: Metadata = { title: 'Cadastro de TLCista' };

export default function Cadastro() {
  return (
    <section className="container-tlc grid place-items-center py-10">
      <div className="cartao w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Guadalupe className="mb-3 h-20 w-16" />
          <h1 className="text-2xl">Cadastro de TLCista</h1>
          <p className="mt-1 text-texto-apoio">Este site é só para quem já fez o TLC. Depois do cadastro, a coordenação confere e libera o seu acesso.</p>
        </div>
        <CadastroForm />
        <p className="mt-6 text-center text-sm text-texto-apoio">
          Já tem cadastro? <Link href="/portal/entrar" className="font-semibold text-primaria underline">Entrar</Link>
        </p>
      </div>
    </section>
  );
}
