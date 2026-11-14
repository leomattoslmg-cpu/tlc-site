import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacidade' };

// Texto-base: o TLC deve revisá-lo (idealmente com apoio jurídico) antes da publicação.
export default function Privacidade() {
  return (
    <section className="container-tlc max-w-3xl py-12">
      <h1 className="text-3xl sm:text-4xl">Privacidade</h1>
      <div className="mt-2 h-1 w-16 rounded bg-destaque" aria-hidden />
      <div className="mt-8 space-y-5 text-lg leading-relaxed">
        <p>
          O site público do TLC Ponta Porã - MS coleta dados pessoais apenas quando você envia o formulário de contato: nome, e-mail, telefone (opcional), assunto e mensagem. Usamos esses dados somente para responder a você.
        </p>
        <p>As mensagens ficam guardadas na caixa da Secretaria e podem ser apagadas a pedido seu. Não vendemos nem compartilhamos seus dados com terceiros para fins comerciais.</p>
        <p>Para pedir acesso, correção ou exclusão dos seus dados, use a página de Contato.</p>
      </div>
    </section>
  );
}
