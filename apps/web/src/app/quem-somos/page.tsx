import type { Metadata } from 'next';
import { PaginaTexto } from '@/components/pagina-texto';

export const metadata: Metadata = { title: 'Quem Somos' };
export const revalidate = 300;

export default function QuemSomos() {
  return <PaginaTexto slug="quem-somos" titulo="Quem Somos" />;
}
