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

function mascaraData(v: string) {
  const d = digitos(v).slice(0, 8);
  return d.replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
}

/** "20/12/1999" -> "1999-12-20"; devolve null se a data não existir ou estiver no futuro. */
function dataParaIso(v: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return null;
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  if (ano < 1900 || d.getTime() > Date.now()) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function CadastroForm({ token }: { token?: string }) {
  const [v, setV] = useState({ nome: '', cpf: '', email: '', nascimento: '', edicao: '', comunidade: '', telefone: '', cidade: '', senha: '', senha2: '' });
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return setErro('Confira o e-mail.');
    const nascimentoIso = dataParaIso(v.nascimento);
    if (!nascimentoIso) return setErro('Confira a data de nascimento (dia/mês/ano, por exemplo 20/12/1999).');
    if (!v.edicao.trim()) return setErro('Informe qual TLC você fez.');
    if (!v.comunidade.trim()) return setErro('Informe em qual comunidade você serve.');
    const tel = digitos(v.telefone);
    if (tel.length < 10 || tel.length > 11) return setErro('Telefone com DDD, por exemplo (67) 99999-9999.');
    if (v.cidade.trim().length < 2) return setErro('Informe a cidade.');
    if (v.senha.length < 8 || !/\d/.test(v.senha) || !/[A-Za-zÀ-ÿ]/.test(v.senha)) return setErro('A senha precisa ter ao menos 8 caracteres, com letra e número.');
    if (v.senha !== v.senha2) return setErro('As duas senhas não são iguais. Digite a mesma senha nos dois campos.');
    if (!termo) return setErro('É preciso aceitar o uso dos dados para se cadastrar.');
    if (TURNSTILE_KEY && !captcha) return setErro('Confirme que você não é um robô.');

    if (!API_URL) return setErro('Este site está sem o endereço da API (variável NEXT_PUBLIC_API_URL na Vercel). Avise a administração.');
    setEnviando(true);
    try {
      const r = await fetch(token ? `${API_URL}/public/cadastro/${encodeURIComponent(token)}` : `${API_URL}/public/cadastro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          nome: v.nome.trim(),
          edicao_tlc: v.edicao.trim(),
          comunidade: v.comunidade.trim(),
          cidade: v.cidade.trim(),
          cpf: v.cpf,
          nascimento: nascimentoIso,
          telefone: `+55${tel}`,
          email: v.email.trim(),
          senha: v.senha,
          termo_aceito: true,
          captcha_token: TURNSTILE_KEY ? captcha : 'dev-sem-captcha',
        }),
      });
      if (r.status === 201) return setFeito(true);
      const d = (await r.json().catch(() => null)) as { detail?: string; title?: string; errors?: { mensagem: string }[] } | null;
      const acordando = [502, 503, 504].includes(r.status);
      setErro(d?.errors?.[0]?.mensagem || d?.detail || d?.title || (acordando ? 'O servidor está acordando. Espere 1 minuto e envie de novo.' : `Não foi possível concluir o cadastro (erro ${r.status}). Detalhe técnico: ${r.url || 'sem endereço'} [${r.headers.get('content-type') ?? 'sem tipo'}]. Tente de novo em instantes.`));
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
        <p className="text-texto-apoio">A coordenação vai conferir o seu cadastro e aprovar o seu acesso. Depois disso, entre com o seu CPF e a senha que você criou.</p>
        <Link href="/portal/entrar" className="btn-secundario mt-3">Ir para a entrada</Link>
      </div>
    );
  }

  return (
    <form onSubmit={aoEnviar} noValidate className="space-y-4">
      {TURNSTILE_KEY && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />}
      <div><L id="nome" t="Nome completo" /><input id="nome" autoComplete="name" className="campo" {...campo('nome')} /></div>
      <div><L id="cpf" t="CPF" /><input id="cpf" inputMode="numeric" placeholder="000.000.000-00" className="campo" value={v.cpf} onChange={(e) => setV({ ...v, cpf: mascaraCpf(e.target.value) })} /></div>
      <div><L id="email" t="E-mail" /><input id="email" type="email" inputMode="email" autoComplete="email" className="campo" {...campo('email')} /></div>
      <div><L id="nasc" t="Data de nascimento" /><input id="nasc" inputMode="numeric" autoComplete="bday" placeholder="dd/mm/aaaa" maxLength={10} className="campo" value={v.nascimento} onChange={(e) => setV({ ...v, nascimento: mascaraData(e.target.value) })} /></div>
      <div><L id="edicao" t="Qual TLC você fez?" /><input id="edicao" className="campo" placeholder="Ex.: 87º TLC" {...campo('edicao')} /></div>
      <div><L id="comunidade" t="Em qual comunidade você serve?" /><input id="comunidade" className="campo" {...campo('comunidade')} /></div>
      <div><L id="tel" t="Telefone (WhatsApp)" /><input id="tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="(67) 99999-9999" className="campo" {...campo('telefone')} /></div>
      <div><L id="cidade" t="Cidade" /><input id="cidade" autoComplete="address-level2" className="campo" {...campo('cidade')} /></div>
      <div>
        <L id="senha" t="Crie uma senha" />
        <input id="senha" type="password" autoComplete="new-password" className="campo" {...campo('senha')} />
        <p className="mt-1 text-sm text-texto-apoio">Mínimo de 8 caracteres, com letra e número.</p>
      </div>
      <div><L id="senha2" t="Repita a senha" /><input id="senha2" type="password" autoComplete="new-password" className="campo" {...campo('senha2')} /></div>
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
