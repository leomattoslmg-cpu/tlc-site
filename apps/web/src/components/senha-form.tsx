'use client';

import { useState } from 'react';
import { chamarPortal } from '@/lib/cliente';

export function SenhaForm() {
  const [v, setV] = useState({ atual: '', nova: '', repetir: '' });
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    if (!v.atual) return setErro('Informe a senha atual.');
    if (v.nova.length < 8 || !/\d/.test(v.nova) || !/[A-Za-zÀ-ÿ]/.test(v.nova)) return setErro('A nova senha precisa ter ao menos 8 caracteres, com letra e número.');
    if (v.nova !== v.repetir) return setErro('As duas senhas novas não são iguais.');
    setEnviando(true);
    const r = await chamarPortal('me/senha', 'POST', { senha_atual: v.atual, senha_nova: v.nova });
    setEnviando(false);
    if (!r.ok) return setErro(r.mensagem ?? 'Não foi possível trocar a senha.');
    setOk(true);
    setV({ atual: '', nova: '', repetir: '' });
  }

  const campo = (k: keyof typeof v) => ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });
  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <div><label htmlFor="sa" className="mb-1 block font-semibold">Senha atual</label><input id="sa" type="password" autoComplete="current-password" className="campo" {...campo('atual')} /></div>
      <div><label htmlFor="sn" className="mb-1 block font-semibold">Nova senha</label><input id="sn" type="password" autoComplete="new-password" className="campo" {...campo('nova')} /><p className="mt-1 text-sm text-texto-apoio">Mínimo de 8 caracteres, com letra e número.</p></div>
      <div><label htmlFor="sr" className="mb-1 block font-semibold">Repita a nova senha</label><input id="sr" type="password" autoComplete="new-password" className="campo" {...campo('repetir')} /></div>
      {erro && <p role="alert" className="rounded-cartao border border-cat-importante p-3 text-sm font-semibold text-cat-importante">{erro}</p>}
      {ok && <p role="status" className="rounded-cartao border border-cat-eventos p-3 font-semibold text-cat-eventos">Senha trocada. Nos outros aparelhos você precisará entrar de novo.</p>}
      <button type="submit" disabled={enviando} className="btn-primario w-full disabled:opacity-60">{enviando ? 'Salvando…' : 'Trocar senha'}</button>
    </form>
  );
}
