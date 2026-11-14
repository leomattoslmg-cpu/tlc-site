import { API_URL } from './site';
import type { Album, Evento, PaginaSite } from './types';

const REVALIDAR_SEGUNDOS = 300;

/** Busca em /public/*. Devolve null se a API não estiver configurada ou falhar, para a página mostrar o estado vazio. */
async function buscar<T>(caminho: string): Promise<T | null> {
  if (!API_URL) return null;
  try {
    const r = await fetch(`${API_URL}${caminho}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDAR_SEGUNDOS },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function eventosPublicos(): Promise<Evento[]> {
  const r = await buscar<{ data: Evento[] }>('/public/eventos');
  return (r?.data ?? []).filter((e) => e.status !== 'rascunho');
}

export async function albunsPublicos(): Promise<Album[]> {
  const r = await buscar<{ data: Album[] }>('/public/albuns');
  return r?.data ?? [];
}

export async function paginaPublica(slug: string): Promise<PaginaSite | null> {
  const p = await buscar<PaginaSite>(`/public/paginas/${encodeURIComponent(slug)}`);
  return p && p.publicado !== false ? p : null;
}
