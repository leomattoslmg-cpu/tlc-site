import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { EntrarForm } from '@/components/entrar-form';
import { Guadalupe } from '@/components/guadalupe';
import { COOKIE_ACESSO } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Entrar', robots: { index: false } };

export default function Entrar({ searchParams }: { searchParams: { proximo?: string } }) {
  const proximo = typeof searchParams.proximo === 'string' ? searchParams.proximo : undefined;
  const destino = proximo && /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(proximo) ? proximo : '/portal';
  if (cookies().get(COOKIE_ACESSO)?.value) redirect(destino);
  return (
    <section className="container-tlc grid min-h-[60vh] place-items-center py-10">
      <div className="cartao w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Guadalupe className="mb-3 h-20 w-16" />
          <h1 className="text-2xl">Área do membro</h1>
          <p className="mt-1 text-texto-apoio">Entre com o seu CPF e a sua senha.</p>
        </div>
        <EntrarForm proximo={proximo} />
        <p className="mt-6 text-center text-sm text-texto-apoio">Esqueceu a senha ou ainda não tem acesso? Fale com a Secretaria do TLC.</p>
      </div>
    </section>
  );
}
