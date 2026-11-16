import { Archive, Megaphone, Pin } from 'lucide-react';
import { paragrafos } from '@/lib/format';

export interface Aviso {
  id: string;
  titulo: string;
  conteudo: string;
  fixado: boolean;
  publico_alvo: string;
  status: string;
  criado_em: string;
  editado_em: string | null;
  categoria: string;
  categoria_nome: string;
  autor: string;
}

const COR: Record<string, string> = {
  geral: 'bg-cat-geral/15 text-cat-geral',
  eventos: 'bg-cat-eventos/15 text-cat-eventos',
  coordenacao: 'bg-cat-coordenacao/15 text-cat-coordenacao',
  importante: 'bg-cat-importante/15 text-cat-importante',
};

export function dataCurta(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Campo_Grande' }).format(new Date(iso)).replace('.', '');
}

export function Chip({ aviso }: { aviso: Pick<Aviso, 'categoria' | 'categoria_nome'> }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${COR[aviso.categoria] ?? COR.geral}`}>{aviso.categoria_nome}</span>;
}

export function AvisoCard({ aviso, acao }: { aviso: Aviso; acao?: React.ReactNode }) {
  const arquivado = aviso.status === 'arquivado';
  return (
    <article className={`cartao overflow-hidden ${arquivado ? 'opacity-70' : ''}`}>
      <div className="h-1 bg-gradient-to-r from-destaque via-destaque/60 to-transparent" aria-hidden />
      <div className="p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chip aviso={aviso} />
          {aviso.fixado && <span className="inline-flex items-center gap-1 text-xs font-semibold text-destaque"><Pin size={14} aria-hidden /> Fixado</span>}
          {arquivado && <span className="inline-flex items-center gap-1 text-xs font-semibold text-texto-apoio"><Archive size={14} aria-hidden /> Arquivado</span>}
          {aviso.publico_alvo === 'coordenacao' && <span className="text-xs font-semibold text-cat-coordenacao">Só coordenação</span>}
        </div>
        <h2 className="text-xl font-bold leading-snug sm:text-2xl">{aviso.titulo}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-texto-apoio">
          <Megaphone size={14} aria-hidden /> {aviso.autor} · {dataCurta(aviso.criado_em)}{aviso.editado_em ? ' · editado' : ''}
        </p>
        <div className="mt-4 space-y-3 leading-relaxed">
          {paragrafos(aviso.conteudo).map((p, i) => (
            <p key={i} className="whitespace-pre-line">{p}</p>
          ))}
        </div>
        {acao && <div className="mt-5 border-t border-borda pt-4">{acao}</div>}
      </div>
    </article>
  );
}
