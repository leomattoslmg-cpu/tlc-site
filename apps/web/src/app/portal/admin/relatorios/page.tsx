import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { AdminNav } from '@/components/admin/admin-nav';

export const metadata: Metadata = { title: 'Planilhas', robots: { index: false } };
export const dynamic = 'force-dynamic';

const RELATORIOS = [
  { id: 'eventos', t: 'Eventos do ano', d: 'Cada evento, com data, local e quantos marcaram presença.' },
  { id: 'presencas', t: 'Presenças (auditoria)', d: 'Cada presença: quem, em qual evento, dia, hora, forma e IP.' },
  { id: 'frequencia', t: 'Frequência por membro', d: 'Quantas vezes cada membro participou no ano, sobre o total de eventos realizados.' },
];

export default function Relatorios({ searchParams }: { searchParams: { ano?: string } }) {
  const atual = new Date().getFullYear();
  const pedido = Number(searchParams.ano);
  const ano = Number.isInteger(pedido) && pedido >= 2020 && pedido <= 2100 ? pedido : atual;
  const anos = Array.from({ length: Math.max(1, atual - 2025) + 1 }, (_, i) => 2026 + i);
  return (
    <div className="container-tlc py-8 sm:py-12">
      <AdminNav atual="/portal/admin/relatorios" />
      <h1 className="mb-2 text-2xl">Planilhas</h1>
      <p className="mb-5 text-texto-apoio">Arquivos que abrem no Excel e no Google Planilhas.</p>
      <form method="get" className="mb-6 flex items-end gap-3">
        <div>
          <label htmlFor="ano" className="mb-1 block font-semibold">Ano</label>
          <select id="ano" name="ano" defaultValue={ano} className="campo w-auto">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button className="btn-secundario min-h-[48px] px-4" type="submit">Ver</button>
      </form>
      <section aria-labelledby="servos" className="cartao mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="servos" className="text-lg">Planilha de servos</h2>
          <p className="text-texto-apoio">Todos que se inscreveram no site: nome, CPF (mascarado), e-mail, telefone, nascimento, TLC, comunidade, cidade, situação do cadastro, cargos e data da inscrição.</p>
        </div>
        <a href="/api/portal/proxy/relatorios/membros" download className="btn-primario gap-2 whitespace-nowrap">
          <Download size={18} aria-hidden /> Baixar servos
        </a>
      </section>
      <h2 className="mb-3 text-lg">Eventos e presença</h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {RELATORIOS.map((r) => (
          <li key={r.id} className="cartao flex flex-col gap-3 p-5">
            <h2 className="text-lg">{r.t}</h2>
            <p className="flex-1 text-texto-apoio">{r.d}</p>
            <a href={`/api/portal/proxy/relatorios/${r.id}?ano=${ano}`} download className="btn-primario gap-2">
              <Download size={18} aria-hidden /> Baixar {ano}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
