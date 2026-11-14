import { CalendarDays, MapPin } from 'lucide-react';
import { dataHoraLonga, diaMes } from '@/lib/format';
import type { Evento } from '@/lib/types';

const SELO: Partial<Record<Evento['status'], { texto: string; classe: string }>> = {
  inscricoes_abertas: { texto: 'Inscrições abertas', classe: 'bg-cat-eventos/15 text-cat-eventos' },
  esgotado: { texto: 'Esgotado', classe: 'bg-cat-geral/15 text-cat-geral' },
  encerrado: { texto: 'Encerrado', classe: 'bg-cat-geral/15 text-cat-geral' },
  cancelado: { texto: 'Cancelado', classe: 'bg-cat-importante/15 text-cat-importante' },
};

export function EventoCard({ evento }: { evento: Evento }) {
  const { dia, mes } = diaMes(evento.inicio_em);
  const selo = SELO[evento.status];
  return (
    <article className="cartao flex gap-4 p-4">
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-cartao border-b-4 border-destaque bg-superficie text-center">
        <div>
          <p className="text-xl font-semibold leading-none">{dia}</p>
          <p className="text-sm uppercase text-texto-apoio">{mes}</p>
        </div>
      </div>
      <div className="min-w-0">
        {selo && <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-sm font-semibold ${selo.classe}`}>{selo.texto}</span>}
        <h3 className="text-lg">{evento.nome}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-texto-apoio">
          <CalendarDays size={16} aria-hidden />
          <time dateTime={evento.inicio_em}>{dataHoraLonga(evento.inicio_em)}</time>
        </p>
        {evento.local_nome && (
          <p className="flex items-center gap-1 text-sm text-texto-apoio">
            <MapPin size={16} aria-hidden /> {evento.local_nome}
          </p>
        )}
        {evento.descricao && <p className="mt-2 line-clamp-3 text-base text-texto-apoio">{evento.descricao}</p>}
      </div>
    </article>
  );
}
