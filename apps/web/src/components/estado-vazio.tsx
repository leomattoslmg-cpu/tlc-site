import Link from 'next/link';

export function EstadoVazio({ titulo, texto, acao }: { titulo: string; texto: string; acao?: { href: string; rotulo: string } }) {
  return (
    <div className="cartao p-8 text-center">
      <h3 className="text-lg">{titulo}</h3>
      <p className="mx-auto mt-2 max-w-md text-base text-texto-apoio">{texto}</p>
      {acao && (
        <Link href={acao.href} className="btn-secundario mt-5">
          {acao.rotulo}
        </Link>
      )}
    </div>
  );
}
