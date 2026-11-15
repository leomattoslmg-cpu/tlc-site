import type { Metadata } from 'next';
import { CadastroForm } from '@/components/cadastro-form';
import { Guadalupe } from '@/components/guadalupe';
import { API_URL } from '@/lib/site';

export const metadata: Metadata = { title: 'Cadastro de membro', robots: { index: false } };
export const dynamic = 'force-dynamic';

async function conviteValido(token: string): Promise<boolean | null> {
  if (!API_URL) return null;
  try {
    const r = await fetch(`${API_URL}/public/cadastro/${encodeURIComponent(token)}`, { cache: 'no-store', signal: AbortSignal.timeout(65_000) });
    if (!r.ok) return false;
    return Boolean(((await r.json()) as { valido?: boolean }).valido);
  } catch {
    return null;
  }
}

export default async function Cadastro({ params }: { params: { token: string } }) {
  const valido = await conviteValido(params.token);
  return (
    <section className="container-tlc grid place-items-center py-10">
      <div className="cartao w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Guadalupe className="mb-3 h-20 w-16" />
          <h1 className="text-2xl">Cadastro de membro</h1>
        </div>
        {valido === true && <CadastroForm token={params.token} />}
        {valido === false && <p role="alert" className="text-center text-texto-apoio">Este QR Code venceu ou não é válido. Peça um novo à coordenação do TLC.</p>}
        {valido === null && <p role="alert" className="text-center text-texto-apoio">Não foi possível verificar o convite agora. Tente de novo em instantes.</p>}
      </div>
    </section>
  );
}
