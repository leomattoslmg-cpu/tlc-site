import Image from 'next/image';
import { ImageIcon } from 'lucide-react';
import type { Album } from '@/lib/types';

export function AlbumCard({ album }: { album: Album }) {
  return (
    <article className="cartao overflow-hidden">
      <div className="relative aspect-[4/3] bg-superficie">
        {album.capa_url ? (
          <Image src={album.capa_url} alt={`Capa do álbum ${album.titulo}`} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-texto-apoio">
            <ImageIcon size={32} aria-hidden />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg">{album.titulo}</h3>
        <p className="text-sm text-texto-apoio">{album.total_fotos} {album.total_fotos === 1 ? 'foto' : 'fotos'}</p>
      </div>
    </article>
  );
}
