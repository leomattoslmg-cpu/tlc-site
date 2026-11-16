import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DadosForm, type DadosMembro } from '@/components/dados-form';
import { chamarApi, COOKIE_ACESSO } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Meus dados', robots: { index: false } };
export const dynamic = 'force-dynamic';

type MembroLogado = DadosMembro & { cpf_mascarado: string | null };

async function carregar(token: string): Promise<{ membro: MembroLogado | null; expirou: boolean }> {
  try {
    const r = await chamarApi('/me', {}, token);
    if (r.status === 401) return { membro: null, expirou: true };
    if (!r.ok) return { membro: null, expirou: false };
    const d = (await r.json()) as { membro: MembroLogado | null };
    return { membro: d.membro, expirou: false };
  } catch {
    return { membro: null, expirou: false };
  }
}

export default async function Dados() {
  const token = cookies().get(COOKIE_ACESSO)?.value;
  if (!token) redirect('/portal/entrar?proximo=/portal/dados');
  const { membro, expirou } = await carregar(token);
  if (expirou) redirect('/portal/entrar?proximo=/portal/dados');
  return (
    <section className="container-tlc grid py-10">
      <div className="cartao mx-auto w-full max-w-md p-6 sm:p-8">
        <h1 className="mb-1 text-2xl">Meus dados</h1>
        {membro ? (
          <>
            <p className="mb-5 text-texto-apoio">Confira e corrija o que mudou. O CPF não pode ser alterado por aqui; se estiver errado, fale com a Secretaria.</p>
            <DadosForm inicial={membro} cpf={membro.cpf_mascarado} />
          </>
        ) : (
          <p role="alert" className="mb-5">Não foi possível carregar seus dados agora. Tente de novo em instantes.</p>
        )}
        <Link href="/portal" className="mt-5 inline-block font-semibold text-primaria underline">← Voltar ao meu portal</Link>
      </div>
    </section>
  );
}
