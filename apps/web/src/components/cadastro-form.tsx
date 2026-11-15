'use client';

import Script from 'next/script';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/site';

const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

declare global {
  interface Window {
    tlcCaptcha?: (token: string) => void;
  }
}

const digitos = (v: string) => v.replace(/\D/g, '');
function mascaraCpf(v: string) {
  return digitos(v).slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function L({ id, t }: { id: string; t: string }) {
  return <label htmlFor={id} className="mb-1 block text-base font-semibold">{t}</label>;
}

export function CadastroForm({ token }: { token: string }) {
  const [v, setV] = useState({ nome: '', cpf: '', nascimento: '', telefone: '', email: '', senha: '' });
  const [termo, setTermo] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    window.tlcCaptcha = setCaptcha;
    return () => {
      delete window.tlcCaptcha;
    };
  }, []);

  const campo = (k: keyof typeof v) => ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });

  async function aoEnviar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    if (v.nome.trim().length < 3) return setErro('Informe o nome completo.');
    if (digitos(v.cpf).length !== 11) return setErro('O CPF tem 11 números.');
    if (!v.nascimento) return setErro('Informe a data de nascimento.');
    const tel = digitos(v.telefone);
    if (tel.length < 10 || tel.length > 11) return setErro('Telefone com DDD, por exemplo (67) 99999-9999.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return setErro('Confira o e-mail.');
    if (v.senha.length < 8 || !/\d/.test(v.senha) || !/[A-Za-zÀ-ÿ]/.test(v.senha)) return setErro('A senha precisa ter ao menos 8 caracteres, com letra e número.');
    if (!termo) return setErro('É preciso aceitar o uso dos dados para se cadastrar.');
    if (TURNSTILE_KEY && !captcha) return setErro('Confirme que você não é um robô.');

    setEnviando(true);
    try {
      const r = await fetch(`${API_URL}/public/cadastro/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          nome: v.nome.trim(),
          cpf: v.cpf,
          nascimento: v.nascimento,
          telefone: `+55${tel}`,
          email: v.email.trim(),
          senha: v.senha,
          termo_aceito: true,
          captcha_token: TURNSTILE_KEY ? captcha : 'dev-sem-captcha',
        }),
      });
      if (r.status === 201) return setFeito(true);
      const d = (await r.json().catch(() => null)) as { detail?: string; title?: string; errors?: { mensagem: string }[] } | null;
      setErro(d?.errors?.[0]?.mensagem || d?.detail || d?.title || 'Não foi possível concluir o cadastro.');
    } catch {
      setErro('Sem conexão com o servidor. Confira a internet e tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  if (feito) {
    return (
      <div role="status" className="space-y-2 text-center">
        <h2 className="text-xl">Cadastro enviado!</h2>
        <p className="text-texto-apoio">A Secretaria vai aprovar o seu acesso. Depois disso, entre com o seu CPF e a senha que você criou.</p>
        <Link href="/portal/entrar" className="btn-secundario mt-3">Ir para a entrada</Link>
      </div>
    );
  }

  return (
    <form onSubmit={aoEnviar} noValidate className="space-y-4">
      {TURNSTILE_KEY && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />}
      <div><L id="nome" t="Nome completo" /><input id="nome" autoComplete="name" className="campo" {...campo('nome')} /></div>
      <div><L id="cpf" t="CPF" /><input id="cpf" inputMode="numeric" placeholder="000.000.000-00" className="campo" value={v.cpf} onChange={(e) => setV({ ...v, cpf: mascaraCpf(e.target.value) })} /></div>
      <div><L id="nasc" t="Data de nascimento" /><input id="nasc" type="date" autoComplete="bday" className="campo" value={v.nascimento} onChange={(e) => setV({ ...v, nascimento: e.target.value })} /></div>
      <div><L id="tel" t="Telefone / WhatsApp" /><input id="tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="(67) 99999-9999" className="campo" {...campo('telefone')} /></div>
      <div><L id="email" t="E-mail" /><input id="email" type="email" inputMode="email" autoComplete="email" className="campo" {...campo('email')} /></div>
      <div>
        <L id="senha" t="Crie uma senha" />
        <input id="senha" type="password" autoComplete="new-password" className="campo" {...campo('senha')} />
        <p className="mt-1 text-sm text-texto-apoio">Mínimo de 8 caracteres, com letra e número.</p>
      </div>
      <label className="flex items-start gap-3 text-base">
        <input type="checkbox" checked={termo} onChange={(e) => setTermo(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
        <span>Concordo com o uso dos meus dados pelo TLC, como explica a <Link href="/privacidade" target="_blank" className="font-semibold text-primaria underline">política de privacidade</Link>.</span>
      </label>
      {TURNSTILE_KEY && <div className="cf-turnstile" data-sitekey={TURNSTILE_KEY} data-callback="tlcCaptcha" />}
      {erro && <p role="alert" className="rounded-cartao border border-cat-importante p-3 text-sm font-semibold text-cat-importante">{erro}</p>}
      <button type="submit" disabled={enviando} className="btn-primario w-full disabled:opacity-60">{enviando ? 'Enviando…' : 'Enviar cadastro'}</button>
    </form>
  );
}
