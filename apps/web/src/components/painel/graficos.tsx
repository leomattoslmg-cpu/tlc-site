import type { ReactNode } from 'react';

export interface Ponto {
  rotulo: string;
  valor: number;
}

/** Cartão de número grande no topo do painel. */
export function Kpi({ titulo, valor, detalhe, icone }: { titulo: string; valor: ReactNode; detalhe?: string; icone: ReactNode }) {
  return (
    <div className="cartao flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-texto-apoio">{titulo}</p>
        <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight">{valor}</p>
        {detalhe && <p className="mt-2 text-sm text-texto-apoio">{detalhe}</p>}
      </div>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primaria/10 text-primaria">{icone}</span>
    </div>
  );
}

/** Moldura de gráfico: título, explicação e conteúdo. */
export function Quadro({ titulo, texto, children, className = '' }: { titulo: string; texto?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`cartao p-5 sm:p-6 ${className}`}>
      <h2 className="text-lg font-bold">{titulo}</h2>
      {texto && <p className="mb-4 text-sm text-texto-apoio">{texto}</p>}
      {!texto && <div className="mb-4" />}
      {children}
    </section>
  );
}

export function SemDados({ texto = 'Sem dados suficientes ainda.' }: { texto?: string }) {
  return <div className="grid min-h-[160px] place-items-center rounded-cartao border border-dashed border-borda p-6 text-center text-texto-apoio">{texto}</div>;
}

/** Barras em pé (ex.: participantes por TLC, presenças por mês). Rola para o lado se houver muitas. */
export function BarrasVerticais({ dados, unidade = '' }: { dados: Ponto[]; unidade?: string }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  if (dados.length === 0 || dados.every((d) => d.valor === 0)) return <SemDados />;
  return (
    <div className="overflow-x-auto pb-1" role="img" aria-label={dados.map((d) => `${d.rotulo}: ${d.valor}`).join('; ')}>
      <div className="flex h-56 items-end gap-2 border-b border-borda px-1" style={{ minWidth: `${dados.length * 44}px` }}>
        {dados.map((d) => (
          <div key={d.rotulo} className="group flex h-full min-w-[36px] flex-1 flex-col justify-end" title={`${d.rotulo}: ${d.valor}${unidade}`}>
            <span className="mb-1 text-center text-xs font-bold">{d.valor > 0 ? d.valor : ''}</span>
            <div className="w-full rounded-t-md bg-primaria transition group-hover:opacity-80" style={{ height: `${Math.max(d.valor > 0 ? 4 : 0, (d.valor / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 px-1" style={{ minWidth: `${dados.length * 44}px` }}>
        {dados.map((d) => (
          <span key={d.rotulo} className="min-w-[36px] flex-1 truncate text-center text-xs text-texto-apoio" title={d.rotulo}>{d.rotulo}</span>
        ))}
      </div>
    </div>
  );
}

/** Barras deitadas (ex.: presenças por evento, participantes por comunidade). */
export function BarrasHorizontais({ dados, sufixo = '' }: { dados: (Ponto & { detalhe?: string })[]; sufixo?: string }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  if (dados.length === 0) return <SemDados />;
  return (
    <ul className="space-y-3">
      {dados.map((d) => (
        <li key={d.rotulo}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold" title={d.rotulo}>{d.rotulo}</span>
            <span className="shrink-0 font-bold">{d.valor}{sufixo}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-borda/60" role="presentation">
            <div className="h-full rounded-full bg-primaria" style={{ width: `${Math.max(d.valor > 0 ? 3 : 0, (d.valor / max) * 100)}%` }} />
          </div>
          {d.detalhe && <p className="mt-0.5 text-xs text-texto-apoio">{d.detalhe}</p>}
        </li>
      ))}
    </ul>
  );
}
