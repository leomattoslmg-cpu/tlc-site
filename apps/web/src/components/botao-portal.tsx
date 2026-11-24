'use client';

import { useEffect, useState } from 'react';
import { PORTAL_URL } from '@/lib/site';

/** "Cadastrar" e "Entrar" por padrão; vira "Meu portal" quando há sessão. Feito no navegador para o resto do site continuar estático. */
export function BotaoPortal() {
  const [logado, setLogado] = useState(false);
  useEffect(() => {
    fetch('/api/portal/sessao', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setLogado(Boolean(d.logado)))
      .catch(() => undefined);
  }, []);
  if (logado) return <a href="/portal" className="btn-primario min-h-[44px] px-4">Meu portal</a>;
  return (
    <>
      <a href="/cadastro" className="btn-secundario min-h-[44px] px-3 sm:px-4">Cadastrar</a>
      <a href={PORTAL_URL} className="btn-primario min-h-[44px] px-3 sm:px-4">Entrar</a>
    </>
  );
}
