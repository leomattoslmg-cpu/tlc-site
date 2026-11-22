import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, ClipboardCheck, ClipboardList, UserCheck, Users } from 'lucide-react';
import { AdminNav, SemAcesso } from '@/components/admin/admin-nav';
import { BarrasHorizontais, BarrasVerticais, Kpi, Quadro, SemDados } from '@/components/painel/graficos';
import { apiAutenticada } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Painel do TLC', robots: { index: false } };
export const dynamic = 'force-dynamic';

interface Contagem { rotulo: string; total: number }
interface Evento { id: string; nome: string; inicio_em: string; fim_em: string; local_nome: string | null; presentes: number }
interface Painel {
  ano: number;
  anos: number[];
  ver_nomes: boolean;
  totais: { participantes: number; pendentes: number; eventos: number; realizados: number; proximos: number; presencas: number; presencas_hoje: number };
  por_tlc: Contagem[];
  por_comunidade: Contagem[];
  por_cidade: Contagem[];
  eventos: Evento[];
  por_mes: { mes: number; presencas: number; eventos: number }[];
  cadastros_por_mes: { ym: string; total: number }[];
  ultimas_presencas: { nome: string; evento: string; registrado_em: string; metodo: string }[] | null;
  mais_presentes: { nome: string; presencas: number }[] | null;
  sem_presenca: number | null;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const FUSO = 'America/Campo_Grande';
const dia = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO }).format(new Date(iso));
const diaHora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: FUSO }).format(new Date(iso));

/** "TLC 19", "19º TLC", "19" -> 19 (para ordenar os TLCs em ordem numérica). */
const numeroDoTlc = (r: string) => {
  const m = /\d+/.exec(r);
  return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
};

export default async function PainelPagina({ searchParams }: { searchParams: { ano?: string } }) {
  const ano = /^\d{4}$/.test(searchParams.ano ?? '') ? searchParams.ano : '';
  const p = await apiAutenticada<Painel>(`/painel${ano ? `?ano=${ano}` : ''}`);
  if (!p) {
    return (
      <div className="container-tlc py-8 sm:py-12">
        <AdminNav atual="/portal/admin/painel" />
        <SemAcesso />
      </div>
    );
  }
  const t = p.totais;
  const porTlc = [...p.por_tlc].sort((a, b) => numeroDoTlc(a.rotulo) - numeroDoTlc(b.rotulo) || a.rotulo.localeCompare(b.rotulo, 'pt-BR')).map((x) => ({ rotulo: x.rotulo, valor: x.total }));
  const realizados = p.eventos.filter((e) => new Date(e.fim_em).getTime() < Date.now());
  const maisCheios = [...realizados].sort((a, b) => b.presentes - a.presentes).slice(0, 8);
  const media = realizados.length ? Math.round((realizados.reduce((s, e) => s + e.presentes, 0) / realizados.length) * 10) / 10 : 0;
  const melhor = maisCheios[0];
  const mesesDoAno = MESES.map((m, i) => ({ rotulo: m, valor: p.por_mes.find((x) => x.mes === i + 1)?.presencas ?? 0 }));
  const cadastros = p.cadastros_por_mes.map((c) => {
    const [a, m] = c.ym.split('-');
    return { rotulo: `${MESES[Number(m) - 1]}/${a.slice(2)}`, valor: c.total };
  });
  const maxFreq = Math.max(1, t.realizados, ...(p.mais_presentes ?? []).map((m) => m.presencas));

  return (
    <div className="container-tlc py-8 sm:py-12">
      <AdminNav atual="/portal/admin/painel" />

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-destaque">Coordenação</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">Painel do TLC</h1>
          <p className="mt-1 text-texto-apoio">Visão geral dos participantes, eventos e presenças.</p>
        </div>
        <nav aria-label="Ano" className="flex flex-wrap gap-2">
          {p.anos.map((a) => (
            <Link key={a} href={`/portal/admin/painel?ano=${a}`} aria-current={a === p.ano ? 'page' : undefined}
              className={`inline-flex min-h-[40px] items-center rounded-full px-4 text-sm font-bold ${a === p.ano ? 'bg-primaria text-primaria-sobre' : 'border border-borda hover:bg-superficie'}`}>{a}</Link>
          ))}
        </nav>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Participantes" valor={t.participantes} detalhe={t.pendentes > 0 ? `${t.pendentes} aguardando aprovação` : 'Cadastros aprovados'} icone={<Users size={24} aria-hidden />} />
        <Kpi titulo={`Eventos em ${p.ano}`} valor={t.eventos} detalhe={`${t.realizados} realizado(s) · ${t.proximos} a caminho`} icone={<CalendarDays size={24} aria-hidden />} />
        <Kpi titulo="Presenças" valor={t.presencas} detalhe={realizados.length ? `Média de ${String(media).replace('.', ',')} por evento` : 'Nenhum evento realizado ainda'} icone={<ClipboardCheck size={24} aria-hidden />} />
        <Kpi titulo="Presenças do dia" valor={t.presencas_hoje} detalhe="Marcadas hoje" icone={<ClipboardList size={24} aria-hidden />} />
      </div>

      {(t.pendentes > 0 || melhor) && (
        <ul className="cartao mt-4 space-y-1.5 p-5 text-base">
          {t.pendentes > 0 && (
            <li className="flex flex-wrap items-center gap-2"><UserCheck size={18} className="text-destaque" aria-hidden />
              <span><strong>{t.pendentes}</strong> cadastro(s) esperando aprovação.</span>
              <Link href="/portal/admin/membros" className="font-semibold text-primaria underline">Aprovar agora</Link></li>
          )}
          {melhor && melhor.presentes > 0 && (
            <li>Evento com mais presentes em {p.ano}: <strong>{melhor.nome}</strong> ({melhor.presentes}).</li>
          )}
          {p.sem_presenca !== null && t.realizados > 0 && (
            <li><strong>{p.sem_presenca}</strong> participante(s) ainda sem nenhuma presença em {p.ano}.</li>
          )}
        </ul>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Quadro titulo="Participantes por TLC" texto="Distribuição dos cadastros aprovados por TLC realizado.">
          <BarrasVerticais dados={porTlc} />
        </Quadro>
        <Quadro titulo="Presenças por evento" texto="Os encontros com maior participação.">
          {maisCheios.length === 0 ? <SemDados /> : (
            <BarrasHorizontais dados={maisCheios.map((e) => ({ rotulo: e.nome, valor: e.presentes, detalhe: dia(e.inicio_em) }))} />
          )}
        </Quadro>
        <Quadro titulo={`Presenças por mês em ${p.ano}`} texto="Total de presenças marcadas nos eventos de cada mês.">
          <BarrasVerticais dados={mesesDoAno} />
        </Quadro>
        <Quadro titulo="Novos cadastros por mês" texto="Pessoas que se cadastraram nos últimos 12 meses.">
          <BarrasVerticais dados={cadastros} />
        </Quadro>
        <Quadro titulo="Participantes por comunidade" texto="As 10 comunidades com mais participantes.">
          <BarrasHorizontais dados={p.por_comunidade.map((c) => ({ rotulo: c.rotulo, valor: c.total }))} />
        </Quadro>
        <Quadro titulo="Participantes por cidade" texto="As 10 cidades com mais participantes.">
          <BarrasHorizontais dados={p.por_cidade.map((c) => ({ rotulo: c.rotulo, valor: c.total }))} />
        </Quadro>
      </div>

      {p.ver_nomes && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Quadro titulo="Últimas presenças" texto="As 10 presenças mais recentes.">
            {!p.ultimas_presencas || p.ultimas_presencas.length === 0 ? <SemDados /> : (
              <ul className="divide-y divide-borda">
                {p.ultimas_presencas.map((u, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-2.5">
                    <span className="min-w-0"><span className="block truncate font-semibold">{u.nome}</span><span className="block truncate text-sm text-texto-apoio">{u.evento}</span></span>
                    <span className="shrink-0 text-right text-sm text-texto-apoio">{diaHora(u.registrado_em)}<br />{u.metodo === 'qr' ? 'QR Code' : 'Manual'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Quadro>
          <Quadro titulo="Mais presentes no ano" texto={`Quem mais participou dos eventos de ${p.ano}.`}>
            {!p.mais_presentes || p.mais_presentes.length === 0 ? <SemDados /> : (
              <BarrasHorizontais dados={p.mais_presentes.map((m) => ({ rotulo: m.nome, valor: m.presencas, detalhe: `${Math.round((m.presencas / maxFreq) * 100)}% dos eventos realizados` }))} />
            )}
          </Quadro>
        </div>
      )}

      <Quadro className="mt-6" titulo={`Eventos de ${p.ano}`} texto="Toque num evento para ver quem esteve presente.">
        {p.eventos.length === 0 ? <SemDados texto="Nenhum evento neste ano." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-borda text-xs uppercase tracking-wide text-texto-apoio">
                  <th className="py-2 pr-3 font-bold">Evento</th><th className="py-2 pr-3 font-bold">Data</th>
                  <th className="py-2 pr-3 font-bold">Situação</th><th className="py-2 text-right font-bold">Presentes</th><th className="py-2 pl-3 text-right font-bold">% dos participantes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {p.eventos.map((e) => {
                  const feito = new Date(e.fim_em).getTime() < Date.now();
                  return (
                    <tr key={e.id}>
                      <td className="py-2.5 pr-3 font-semibold"><Link href={`/portal/admin/eventos/${e.id}`} className="text-primaria hover:underline">{e.nome}</Link></td>
                      <td className="py-2.5 pr-3 text-texto-apoio">{dia(e.inicio_em)}</td>
                      <td className="py-2.5 pr-3">{feito ? 'Realizado' : 'A caminho'}</td>
                      <td className="py-2.5 text-right font-bold">{e.presentes}</td>
                      <td className="py-2.5 pl-3 text-right text-texto-apoio">{feito && t.participantes > 0 ? `${Math.round((e.presentes / t.participantes) * 100)}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Quadro>

      <p className="mt-6 text-sm text-texto-apoio">
        Precisa levar os dados para o Excel? <Link href="/portal/admin/relatorios" className="font-semibold text-primaria underline">Baixe as planilhas</Link>.
      </p>
    </div>
  );
}
