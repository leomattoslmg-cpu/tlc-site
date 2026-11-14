'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/site';

const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

type Campos = 'nome' | 'email' | 'telefone' | 'assunto' | 'mensagem';
type Erros = Partial<Record<Campos | 'geral', string>>;

declare global {
  interface Window {
    tlcCaptcha?: (token: string) => void;
  }
}

function validar(v: Record<Campos, string>): Erros {
  const e: Erros = {};
  if (v.nome.trim().length < 2) e.nome = 'Informe seu nome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'Confira o e-mail: falta algo, como o @ ou o final (.com).';
  const tel = v.telefone.replace(/\D/g, '');
  if (tel && (tel.length < 10 || tel.length > 11)) e.telefone = 'Telefone com DDD, por exemplo (67) 99999-9999.';
  if (v.assunto.trim().length < 3) e.assunto = 'Diga o assunto em poucas palavras.';
  if (v.mensagem.trim().length < 10) e.mensagem = 'Escreva um pouco mais, para podermos ajudar.';
  if (v.mensagem.length > 2000) e.mensagem = 'A mensagem pode ter até 2.000 caracteres.';
  return e;
}

function Campo({ nome, rotulo, erro, tipo = 'text', obrigatorio = true, autoComplete, inputMode }: { nome: Campos; rotulo: string; erro?: string; tipo?: string; obrigatorio?: boolean; autoComplete?: string; inputMode?: 'tel' | 'email' }) {
  return (
    <div>
      <label htmlFor={nome} className="mb-1 block text-base font-semibold">
        {rotulo} {!obrigatorio && <span className="font-normal text-texto-apoio">(opcional)</span>}
      </label>
      <input id={nome} name={nome} type={tipo} autoComplete={autoComplete} inputMode={inputMode} aria-invalid={!!erro} aria-describedby={erro ? `${nome}-erro` : undefined} className="campo" />
      {erro && (
        <p id={`${nome}-erro`} className="mt-1 text-sm font-semibold text-cat-importante">
          {erro}
        </p>
      )}
    </div>
  );
}

export function ContatoForm() {
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    window.tlcCaptcha = setToken;
    return () => {
      delete window.tlcCaptcha;
    };
  }, []);

  async function aoEnviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    const v = Object.fromEntries(['nome', 'email', 'telefone', 'assunto', 'mensagem'].map((c) => [c, String(form.get(c) ?? '')])) as Record<Campos, string>;
    const e = validar(v);
    if (Object.keys(e).length) return setErros(e);
    if (!API_URL) return setErros({ geral: 'O envio pelo site está indisponível no momento. Use o e-mail ou o Instagram do rodapé.' });
    if (TURNSTILE_KEY && !token) return setErros({ geral: 'Confirme que você não é um robô antes de enviar.' });

    setErros({});
    setEnviando(true);
    try {
      const r = await fetch(`${API_URL}/public/contato`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          nome: v.nome.trim(),
          email: v.email.trim(),
          ...(v.telefone.replace(/\D/g, '') && { telefone: v.telefone.replace(/\D/g, '') }),
          assunto: v.assunto.trim(),
          mensagem: v.mensagem.trim(),
          captcha_token: TURNSTILE_KEY ? token : 'dev-sem-captcha',
        }),
      });
      if (r.status === 202) return setEnviado(true);
      if (r.status === 429) return setErros({ geral: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.' });
      if (r.status === 422) {
        const corpo = (await r.json().catch(() => null)) as { errors?: { campo: string; mensagem: string }[] } | null;
        const porCampo: Erros = {};
        for (const x of corpo?.errors ?? []) porCampo[x.campo as Campos] = x.mensagem;
        return setErros(Object.keys(porCampo).length ? porCampo : { geral: 'Confira os dados e tente de novo.' });
      }
      setErros({ geral: 'Não conseguimos enviar agora. Tente de novo em instantes.' });
    } catch {
      setErros({ geral: 'Sem conexão com o servidor. Verifique a internet e tente de novo.' });
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div role="status" className="cartao border-cat-eventos p-6">
        <h2 className="text-xl">Mensagem enviada.</h2>
        <p className="mt-2 text-base text-texto-apoio">Recebemos o seu contato e a Secretaria responde em breve. Deus abençoe!</p>
      </div>
    );
  }

  return (
    <form onSubmit={aoEnviar} noValidate className="space-y-5">
      {TURNSTILE_KEY && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />}
      <Campo erro={erros.nome} nome="nome" rotulo="Nome" autoComplete="name" />
      <Campo erro={erros.email} nome="email" rotulo="E-mail" tipo="email" autoComplete="email" inputMode="email" />
      <Campo erro={erros.telefone} nome="telefone" rotulo="Telefone ou WhatsApp" tipo="tel" obrigatorio={false} autoComplete="tel" inputMode="tel" />
      <Campo erro={erros.assunto} nome="assunto" rotulo="Assunto" />
      <div>
        <label htmlFor="mensagem" className="mb-1 block text-base font-semibold">
          Mensagem
        </label>
        <textarea id="mensagem" name="mensagem" rows={6} maxLength={2000} aria-invalid={!!erros.mensagem} aria-describedby={erros.mensagem ? 'mensagem-erro' : undefined} className="campo py-3" />
        {erros.mensagem && (
          <p id="mensagem-erro" className="mt-1 text-sm font-semibold text-cat-importante">
            {erros.mensagem}
          </p>
        )}
      </div>
      {TURNSTILE_KEY && <div className="cf-turnstile" data-sitekey={TURNSTILE_KEY} data-callback="tlcCaptcha" />}
      {erros.geral && (
        <p role="alert" className="rounded-cartao border border-cat-importante bg-cat-importante/10 p-3 text-base text-cat-importante">
          {erros.geral}
        </p>
      )}
      <button type="submit" disabled={enviando} className="btn-primario w-full disabled:opacity-60 sm:w-auto">
        {enviando ? 'Enviando...' : 'Enviar mensagem'}
      </button>
    </form>
  );
}
