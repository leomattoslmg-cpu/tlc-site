import Link from 'next/link';
import { AlbumCard } from '@/components/album-card';
import { EstadoVazio } from '@/components/estado-vazio';
import { EventoCard } from '@/components/evento-card';
import { Guadalupe } from '@/components/guadalupe';
import { LuzDourada } from '@/components/luz-dourada';
import { albunsPublicos, eventosPublicos } from '@/lib/api';
import { SITE_LEMA } from '@/lib/site';

export const revalidate = 300;

export default async function Home() {
  const [eventos, albuns] = await Promise.all([eventosPublicos(), albunsPublicos()]);
  const agora = Date.now();
  const proximos = eventos
    .filter((e) => e.status !== 'cancelado' && new Date(e.fim_em).getTime() >= agora)
    .sort((a, b) => a.inicio_em.localeCompare(b.inicio_em))
    .slice(0, 3);

  return (
    <>
      <section className="overflow-hidden bg-faixa text-white">
        <div className="container-tlc flex flex-col items-center gap-10 py-16 sm:py-24 md:flex-row md:justify-between">
          <div>
          <p className="text-base font-bold uppercase tracking-[0.2em] text-destaque">{SITE_LEMA}</p>
          <h1 className="mt-3 max-w-2xl text-3xl text-white sm:text-5xl">Formando líderes para servir.</h1>
          <p className="mt-4 text-xl font-semibold text-white sm:text-2xl">Medo de nada, só amor!</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/quem-somos" className="btn bg-white text-faixa hover:bg-white/90">
              Conheça o TLC
            </Link>
            <Link href="/eventos" className="btn border border-white/60 text-white hover:bg-white/10">
              Ver próximos eventos
            </Link>
          </div>
          </div>
          <div className="relative grid shrink-0 place-items-center">
            <LuzDourada />
            <Guadalupe className="relative h-72 drop-shadow-lg md:h-80" />
          </div>
        </div>
        <div className="h-1 bg-destaque" aria-hidden />
      </section>

      <section className="container-tlc py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="sublinhado-dourado text-2xl">Próximos eventos</h2>
          <Link href="/eventos" className="text-base font-semibold text-primaria hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {proximos.length > 0 ? (
            proximos.map((e) => <EventoCard key={e.id} evento={e} />)
          ) : (
            <div className="md:col-span-3">
              <EstadoVazio titulo="Ainda não há eventos abertos ao público" texto="Assim que o TLC divulgar o próximo encontro, ele aparece aqui." />
            </div>
          )}
        </div>
      </section>

      <section className="container-tlc py-4" aria-labelledby="membro">
        <div className="cartao flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="membro" className="sublinhado-dourado text-2xl">Faça parte do TLC</h2>
            <p className="mt-1 max-w-xl text-base text-texto-apoio">Se você fez o TLC, faça o seu cadastro. A coordenação confere e libera o acesso. Quem já é membro entra com o CPF e a senha.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/cadastro" className="btn-primario">Quero me cadastrar</Link>
            <Link href="/portal/entrar" className="btn-secundario">Já sou membro</Link>
          </div>
        </div>
      </section>

      <section className="container-tlc py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="sublinhado-dourado text-2xl">Galeria recente</h2>
          <Link href="/galeria" className="text-base font-semibold text-primaria hover:underline">
            Ver galeria completa
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {albuns.length > 0 ? (
            albuns.slice(0, 4).map((a) => <AlbumCard key={a.id} album={a} />)
          ) : (
            <div className="sm:col-span-2 lg:col-span-4">
              <EstadoVazio titulo="A galeria está chegando" texto="As fotos dos nossos encontros vão aparecer aqui." />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
