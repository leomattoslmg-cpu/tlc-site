import type { Metadata } from 'next';
import Link from 'next/link';
import { QrCode } from 'lucide-react';
import { AdminNav, SemAcesso } from '@/components/admin/admin-nav';
import { dataHoraLonga } from '@/lib/format';
import { apiAutenticada } from '@/lib/sessao';

export const metadata: Metadata = { title: 'QR Code dos eventos', robots: { index: false } };
export const dynamic = 'force-dynamic';

interface Ev { id: string; nome: string; inicio_em: string; fim_em: string; status: string; presentes: number }

export default async function QrEventos() {
  const r = await apiAutenticada<{ data: Ev[] }>('/eventos');
  const ativos = r?.data.filter((e) => e.status !== 'cancelado') ?? [];
  const agora = Date.now();
  const proximos = ativos.filter((e) => new Date(e.fim_em).getTime() >= agora).reverse();
  const passados = ativos.filter((e) => new Date(e.fim_em).getTime() < agora);
  const item = (e: Ev) => (
    <li key={e.id}>
      <Link href={`/portal/admin/eventos/${e.id}`} className="cartao flex items-center gap-3 p-4 hover:bg-superficie">
        <QrCode size={24} className="shrink-0 text-primaria" aria-hidden />
        <span>
          <span className="block font-semibold text-primaria">{e.nome}</span>
          <span className="text-sm text-texto-apoio">{dataHoraLonga(e.inicio_em)} · {e.presentes} presente(s)</span>
        </span>
      </Link>
    </li>
  );
  return (
    <div className="container-tlc py-8 sm:py-12">
      <AdminNav atual="/portal/admin/qrcode" />
      {!r ? (
        <SemAcesso />
      ) : (
        <>
          <h1 className="mb-1 text-2xl">QR Code dos eventos</h1>
          <p className="mb-6 text-texto-apoio">Escolha o evento para abrir o QR Code da presença, imprimir o cartaz ou trocar o QR.</p>
          <h2 className="mb-3 text-lg">Próximos e em andamento</h2>
          {proximos.length === 0 ? <p className="mb-8 text-texto-apoio">Nenhum evento a caminho. Crie um em Eventos.</p> : <ul className="mb-8 space-y-3">{proximos.map(item)}</ul>}
          {passados.length > 0 && (
            <>
              <h2 className="mb-3 text-lg">Já realizados</h2>
              <ul className="space-y-3">{passados.map(item)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
