import type { Metadata } from 'next';
import Link from 'next/link';
import { Share, SquarePlus, Smartphone } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Instalar o app',
  description: 'Coloque o TLC Ponta Porã na tela inicial do seu celular, como um aplicativo.',
};

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primaria font-bold text-primaria-sobre" aria-hidden>{n}</span>
      <span className="pt-1 leading-relaxed">{children}</span>
    </li>
  );
}

export default function Instalar() {
  return (
    <section className="container-tlc max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl">Instale o app do TLC</h1>
      <p className="mt-3 text-lg text-texto-apoio">
        Sem baixar nada na loja: o TLC vira um ícone na tela do seu celular e abre em tela cheia, como um aplicativo. É grátis e leva um minuto.
      </p>

      <div className="mt-8 space-y-6">
        <div className="cartao p-6 sm:p-8">
          <h2 className="mb-4 flex items-center gap-3 text-xl font-bold"><Smartphone size={22} aria-hidden /> iPhone (Safari)</h2>
          <ol className="space-y-4">
            <Passo n={1}>Abra <strong>www.tlcpontapora.com.br</strong> no <strong>Safari</strong>. Precisa ser o Safari, não o Instagram, o WhatsApp ou o Chrome.</Passo>
            <Passo n={2}>Toque no botão <strong>Compartilhar</strong> <Share size={16} className="inline align-text-bottom" aria-hidden /> (o quadradinho com a seta para cima, no meio da barra de baixo).</Passo>
            <Passo n={3}>Role a lista e toque em <strong>Adicionar à Tela de Início</strong> <SquarePlus size={16} className="inline align-text-bottom" aria-hidden />.</Passo>
            <Passo n={4}>Toque em <strong>Adicionar</strong>. Pronto: o ícone do TLC aparece na sua tela inicial.</Passo>
          </ol>
        </div>

        <div className="cartao p-6 sm:p-8">
          <h2 className="mb-4 flex items-center gap-3 text-xl font-bold"><Smartphone size={22} aria-hidden /> Android (Chrome)</h2>
          <ol className="space-y-4">
            <Passo n={1}>Abra <strong>www.tlcpontapora.com.br</strong> no <strong>Chrome</strong>.</Passo>
            <Passo n={2}>Toque nos <strong>três pontinhos</strong> no canto de cima.</Passo>
            <Passo n={3}>Toque em <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>) e confirme.</Passo>
          </ol>
        </div>
      </div>

      <p className="mt-8 text-texto-apoio">
        Depois de instalado, é só tocar no ícone para entrar no seu portal, ver os avisos e marcar presença nos eventos.
      </p>
      <Link href="/portal" className="btn-primario mt-6">Ir para o meu portal</Link>
    </section>
  );
}
