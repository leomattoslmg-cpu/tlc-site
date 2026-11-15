'use client';

import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { chamarPortal } from '@/lib/cliente';

export function PresencaBotao({ token, jaRegistrada, aberta, motivo }: { token: string; jaRegistrada: boolean; aberta: boolean; motivo?: string }) {
  const [feito, setFeito] = useState(jaRegistrada);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function marcar() {
    setEnviando(true);
    setErro('');
    const r = await chamarPortal(`presenca/${token}`);
    setEnviando(false);
    if (r.ok) setFeito(true);
    else setErro(r.mensagem ?? 'Não foi possível marcar.');
  }

  if (feito) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 rounded-cartao border border-cat-eventos p-4 text-lg font-semibold text-cat-eventos">
        <CheckCircle2 aria-hidden /> Presença registrada. Deus abençoe!
      </p>
    );
  }
  if (!aberta) return <p className="rounded-cartao border border-borda p-4 text-center text-texto-apoio">{motivo}</p>;
  return (
    <div className="space-y-3">
      <button onClick={marcar} disabled={enviando} className="btn-primario w-full text-lg disabled:opacity-60">
        {enviando ? 'Registrando…' : 'Marcar minha presença'}
      </button>
      {erro && <p role="alert" className="text-center font-semibold text-cat-importante">{erro}</p>}
    </div>
  );
}
