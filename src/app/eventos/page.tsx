import type { Metadata } from 'next';
import { EstadoVazio } from '@/components/estado-vazio';
import { EventoCard } from '@/components/evento-card';
import { eventosPublicos } from '@/lib/api';

export const metadata: Metadata = { title: 'Eventos' };
export const revalidate = 300;

export default async function Eventos() {
  const eventos = await eventosPublicos();
  const agora = Date.now();
  const futuros = eventos.filter((e) => new Date(e.fim_em).getTime() >= agora).sort((a, b) => a.inicio_em.localeCompare(b.inicio_em));
  const passados = eventos.filter((e) => new Date(e.fim_em).getTime() < agora).sort((a, b) => b.inicio_em.localeCompare(a.inicio_em)).slice(0, 6);

  return (
    <section className="container-tlc py-12">
      <h1 className="text-3xl sm:text-4xl">Eventos</h1>
      <div className="mt-2 h-1 w-16 rounded bg-destaque" aria-hidden />

      <h2 className="mt-10 text-2xl">Próximos</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {futuros.length > 0 ? (
          futuros.map((e) => <EventoCard key={e.id} evento={e} />)
        ) : (
          <div className="md:col-span-2">
            <EstadoVazio titulo="Nenhum evento marcado por enquanto" texto="Quando houver um novo encontro aberto ao público, ele aparece aqui. Membros veem a agenda completa no aplicativo." />
          </div>
        )}
      </div>

      {passados.length > 0 && (
        <>
          <h2 className="mt-12 text-2xl">Já realizados</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {passados.map((e) => (
              <EventoCard key={e.id} evento={e} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
