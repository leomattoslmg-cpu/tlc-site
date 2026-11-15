'use client';

import { useEffect, useState } from 'react';
import { PORTAL_URL } from '@/lib/site';

/** "Entrar" por padrão; vira "Meu portal" quando há sessão. Feito no navegador para o resto do site continuar estático. */
export function BotaoPortal() {
  const [logado, setLogado] = useState(false);
  useEffect(() => {
    fetch('/api/portal/sessao', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setLogado(Boolean(d.logado)))
      .catch(() => undefined);
  }, []);
  return (
    <a href={logado ? '/portal' : PORTAL_URL} className="btn-primario min-h-[44px] px-4">
      {logado ? 'Meu portal' : 'Entrar'}
    </a>
  );
}
