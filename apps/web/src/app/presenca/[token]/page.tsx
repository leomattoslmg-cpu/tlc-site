import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PresencaBotao } from '@/components/presenca-botao';
import { dataHoraLonga } from '@/lib/format';
import { apiAutenticada } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Marcar presença', robots: { index: false } };
export const dynamic = 'force-dynamic';

interface Info {
  evento: { nome: string; inicio_em: string; fim_em: string; local_nome: string | null };
  janela: 'ok' | 'cedo' | 'tarde' | 'cancelado';
  ja_registrada: boolean;
}

const MOTIVO: Record<string, string> = {
  cedo: 'A presença abre 2 horas antes do início do evento.',
  tarde: 'A presença deste evento já foi encerrada.',
  cancelado: 'Este evento foi cancelado.',
};

export default async function Presenca({ params }: { params: { token: string } }) {
  const info = await apiAutenticada<Info>(`/presenca/${encodeURIComponent(params.token)}`);
  if (!info) {
    // Sem sessão válida ou QR inexistente: volta para a entrada, que depois traz a pessoa de volta aqui.
    redirect(`/portal/entrar?proximo=${encodeURIComponent(`/presenca/${params.token}`)}`);
  }
  return (
    <section className="container-tlc grid min-h-[60vh] place-items-center py-10">
      <div className="cartao w-full max-w-md space-y-5 p-6 text-center sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-texto-apoio">Presença no evento</p>
        <h1 className="text-2xl">{info.evento.nome}</h1>
        <p className="text-texto-apoio">
          {dataHoraLonga(info.evento.inicio_em)}
          {info.evento.local_nome ? ` · ${info.evento.local_nome}` : ''}
        </p>
        <PresencaBotao token={params.token} jaRegistrada={info.ja_registrada} aberta={info.janela === 'ok'} motivo={MOTIVO[info.janela]} />
      </div>
    </section>
  );
}
