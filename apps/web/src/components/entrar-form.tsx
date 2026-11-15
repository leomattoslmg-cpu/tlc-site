'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

function mascara(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function EntrarForm() {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    if (cpf.replace(/\D/g, '').length !== 11) return setErro('O CPF tem 11 números.');
    if (!senha) return setErro('Informe a senha.');
    setEnviando(true);
    try {
      const r = await fetch('/api/portal/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, senha }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const espera = r.headers.get('retry-after');
        setErro(r.status === 429 && espera ? `Muitas tentativas. Tente de novo em ${Math.ceil(Number(espera) / 60)} minuto(s).` : d.mensagem || 'Não foi possível entrar.');
        setEnviando(false);
        return;
      }
      window.location.href = '/portal';
    } catch {
      setErro('Sem conexão. Confira a internet e tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={aoEnviar} noValidate className="space-y-4">
      <div>
        <label htmlFor="cpf" className="mb-1 block text-base font-semibold">CPF</label>
        <input id="cpf" inputMode="numeric" autoComplete="username" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(mascara(e.target.value))} className="campo" />
      </div>
      <div>
        <label htmlFor="senha" className="mb-1 block text-base font-semibold">Senha</label>
        <div className="relative">
          <input id="senha" type={ver ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="campo pr-12" />
          <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Esconder a senha' : 'Mostrar a senha'} className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-texto-apoio">
            {ver ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
          </button>
        </div>
      </div>
      {erro && <p role="alert" className="rounded-cartao border border-cat-importante p-3 text-sm font-semibold text-cat-importante">{erro}</p>}
      <button type="submit" disabled={enviando} className="btn-primario w-full disabled:opacity-60">
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
      {enviando && <p className="text-center text-sm text-texto-apoio">Na primeira vez do dia, pode levar até 1 minuto.</p>}
    </form>
  );
}
