import type { Metadata } from 'next';
import { PaginaTexto } from '@/components/pagina-texto';

export const metadata: Metadata = { title: 'História do TLC' };
export const revalidate = 300;

export default function Historia() {
  return <PaginaTexto slug="historia" titulo="História do TLC" />;
}
