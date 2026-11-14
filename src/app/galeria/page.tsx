import type { Metadata } from 'next';
import { AlbumCard } from '@/components/album-card';
import { EstadoVazio } from '@/components/estado-vazio';
import { albunsPublicos } from '@/lib/api';

export const metadata: Metadata = { title: 'Galeria' };
export const revalidate = 300;

export default async function Galeria() {
  const albuns = await albunsPublicos();
  return (
    <section className="container-tlc py-12">
      <h1 className="text-3xl sm:text-4xl">Galeria</h1>
      <div className="mt-2 h-1 w-16 rounded bg-destaque" aria-hidden />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {albuns.length > 0 ? (
          albuns.map((a) => <AlbumCard key={a.id} album={a} />)
        ) : (
          <div className="sm:col-span-2 lg:col-span-3">
            <EstadoVazio titulo="Ainda não há álbuns públicos" texto="As fotos dos encontros vão aparecer aqui." />
          </div>
        )}
      </div>
    </section>
  );
}
