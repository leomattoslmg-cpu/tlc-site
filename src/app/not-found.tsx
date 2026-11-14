import Link from 'next/link';

export default function NaoEncontrada() {
  return (
    <section className="container-tlc py-24 text-center">
      <h1 className="text-3xl">Página não encontrada</h1>
      <p className="mt-3 text-lg text-texto-apoio">O endereço pode ter mudado ou não existir mais.</p>
      <Link href="/" className="btn-primario mt-6">
        Voltar ao início
      </Link>
    </section>
  );
}
