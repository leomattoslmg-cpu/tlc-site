import type { Metadata } from 'next';
import Link from 'next/link';
import { QrCode } from 'lucide-react';

export const metadata: Metadata = { title: 'Cadastro de membro' };

export default function CadastroInicio() {
  return (
    <section className="container-tlc grid place-items-center py-12">
      <div className="cartao w-full max-w-lg space-y-5 p-6 text-center sm:p-8">
        <QrCode className="mx-auto text-primaria" size={44} aria-hidden />
        <h1 className="text-2xl">Cadastro de membro</h1>
        <p className="text-lg text-texto-apoio">
          Para se cadastrar, escaneie com a câmera do celular o <strong className="text-texto">QR Code do cadastro</strong>, que a coordenação do TLC mostra nos encontros ou envia a você.
        </p>
        <p className="text-texto-apoio">Você mesmo preenche o seu cadastro. Depois, a coordenação confere e aprova o seu acesso, e você já pode entrar com o CPF e a senha que criou.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/portal/entrar" className="btn-primario">Já tenho cadastro</Link>
          <Link href="/contato" className="btn-secundario">Pedir o QR Code</Link>
        </div>
      </div>
    </section>
  );
}
