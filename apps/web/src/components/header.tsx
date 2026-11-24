import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Guadalupe } from './guadalupe';
import { BotaoPortal } from './botao-portal';
import { MENU, SITE_NOME } from '@/lib/site';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-borda bg-fundo/95 backdrop-blur">
      <div className="container-tlc flex min-h-[64px] items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-primaria">
          <Guadalupe className="h-12 w-10 shrink-0" />
          <span className="hidden flex-col leading-tight sm:flex">
            <span>{SITE_NOME}</span>
            <span className="text-xs font-medium text-texto-apoio">Diocese de Dourados - MS</span>
          </span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {MENU.map((i) => (
            <Link key={i.href} href={i.href} className="rounded-lg px-3 py-2 text-base text-texto hover:bg-superficie">
              {i.rotulo}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <BotaoPortal />
          {/* Menu do celular sem JavaScript: <details> nativo */}
          <details className="relative lg:hidden">
            <summary
              aria-label="Abrir menu"
              className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-cartao border border-borda [&::-webkit-details-marker]:hidden"
            >
              <Menu size={22} aria-hidden />
            </summary>
            <nav aria-label="Principal (celular)" className="cartao absolute right-0 mt-2 w-56 p-2">
              {MENU.map((i) => (
                <Link key={i.href} href={i.href} className="block rounded-lg px-3 py-3 text-base hover:bg-superficie">
                  {i.rotulo}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
