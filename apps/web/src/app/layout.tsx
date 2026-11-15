import type { Metadata, Viewport } from 'next';
import { Nunito_Sans } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { SITE_LEMA, SITE_NOME, SITE_URL } from '@/lib/site';

const fonte = Nunito_Sans({ subsets: ['latin'], variable: '--fonte', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NOME} · ${SITE_LEMA}`, template: `%s · ${SITE_NOME}` },
  description: 'Formando líderes para servir. Medo de nada, só amor! TLC Ponta Porã - MS.',
  openGraph: { siteName: SITE_NOME, locale: 'pt_BR', type: 'website' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#12355B' },
    { media: '(prefers-color-scheme: dark)', color: '#0E2A4A' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={fonte.variable}>
      <body>
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primaria focus:px-3 focus:py-2 focus:text-primaria-sobre">
          Ir para o conteúdo
        </a>
        <Header />
        <main id="conteudo">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
