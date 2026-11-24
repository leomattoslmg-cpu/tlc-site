import Link from 'next/link';
import { CONTATO_EMAIL, CONTATO_INSTAGRAM, SITE_LEMA, SITE_NOME } from '@/lib/site';

export function Footer() {
  return (
    <footer className="mt-16 border-t-2 border-destaque/60 bg-superficie">
      <div className="container-tlc flex flex-col gap-4 py-10 text-base text-texto-apoio sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-destaque-texto">{SITE_NOME}</p>
          <p>{SITE_LEMA}</p>
        </div>
        <ul className="flex flex-col gap-1">
          <li>
            <Link href="/contato" className="underline-offset-2 hover:underline">
              Fale com a gente
            </Link>
          </li>
          {CONTATO_EMAIL && (
            <li>
              <a href={`mailto:${CONTATO_EMAIL}`} className="underline-offset-2 hover:underline">
                {CONTATO_EMAIL}
              </a>
            </li>
          )}
          {CONTATO_INSTAGRAM && (
            <li>
              <a href={CONTATO_INSTAGRAM} rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                Instagram
              </a>
            </li>
          )}
          <li>
            <Link href="/instalar" className="underline-offset-2 hover:underline">
              Instalar o app
            </Link>
          </li>
          <li>
            <Link href="/privacidade" className="underline-offset-2 hover:underline">
              Privacidade
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
