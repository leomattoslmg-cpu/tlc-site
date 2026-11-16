'use client';

import { useState } from 'react';
import { chamarPortal } from '@/lib/cliente';

export interface DadosMembro {
  nome_completo: string;
  data_nascimento: string;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  comunidade: string | null;
  edicao_tlc: string | null;
}

const digitos = (v: string) => v.replace(/\D/g, '');

function mascaraData(v: string) {
  const d = digitos(v).slice(0, 8);
  return d.replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
}

/** "20/12/1999" -> "1999-12-20"; null se a data não existir ou estiver no futuro. */
function dataParaIso(v: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return null;
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  if (ano < 1900 || d.getTime() > Date.now()) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** "2000-01-31" (ou ISO completo) -> "31/01/2000" */
function isoParaData(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** "+5567999999999" -> "(67) 99999-9999" */
function telParaTela(v: string | null) {
  const d = digitos(v ?? '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return d;
}

function L({ id, t }: { id: string; t: string }) {
  return <label htmlFor={id} className="mb-1 block font-semibold">{t}</label>;
}

export function DadosForm({ inicial, cpf }: { inicial: DadosMembro; cpf: string | null }) {
  const [v, setV] = useState({
    nome: inicial.nome_completo,
    nascimento: isoParaData(inicial.data_nascimento),
    email: inicial.email ?? '',
    telefone: telParaTela(inicial.telefone),
    cidade: inicial.cidade ?? '',
    comunidade: inicial.comunidade ?? '',
    edicao: inicial.edicao_tlc ?? '',
  });
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const campo = (k: keyof typeof v) => ({
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setOk(false);
      setV({ ...v, [k]: k === 'nascimento' ? mascaraData(e.target.value) : e.target.value });
    },
  });

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    setOk(false);
    if (v.nome.trim().length < 3) return setErro('Informe o nome completo.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return setErro('Confira o e-mail.');
    const nascimento = dataParaIso(v.nascimento);
    if (!nascimento) return setErro('Confira a data de nascimento (dia/mês/ano, por exemplo 20/12/1999).');
    const tel = digitos(v.telefone).replace(/^55(?=\d{10,11}$)/, '');
    if (tel.length < 10 || tel.length > 11) return setErro('Telefone com DDD, por exemplo (67) 99999-9999.');
    if (v.cidade.trim().length < 2) return setErro('Informe a cidade.');
    if (v.comunidade.trim().length < 2) return setErro('Informe em qual comunidade você serve.');
    if (!v.edicao.trim()) return setErro('Informe qual TLC você fez.');
    setEnviando(true);
    const r = await chamarPortal('me/dados', 'PATCH', {
      nome: v.nome.trim(),
      nascimento,
      email: v.email.trim(),
      telefone: `+55${tel}`,
      cidade: v.cidade.trim(),
      comunidade: v.comunidade.trim(),
      edicao_tlc: v.edicao.trim(),
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.mensagem ?? 'Não foi possível salvar.');
    setOk(true);
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {cpf && (
        <div><L id="d-cpf" t="CPF" /><input id="d-cpf" className="campo opacity-70" value={cpf} readOnly disabled /></div>
      )}
      <div><L id="d-nome" t="Nome completo" /><input id="d-nome" autoComplete="name" className="campo" {...campo('nome')} /></div>
      <div><L id="d-email" t="E-mail" /><input id="d-email" type="email" autoComplete="email" className="campo" {...campo('email')} /></div>
      <div><L id="d-nasc" t="Data de nascimento" /><input id="d-nasc" inputMode="numeric" placeholder="dd/mm/aaaa" className="campo" {...campo('nascimento')} /></div>
      <div><L id="d-edicao" t="Qual TLC você fez?" /><input id="d-edicao" className="campo" {...campo('edicao')} /></div>
      <div><L id="d-com" t="Em qual comunidade você serve?" /><input id="d-com" className="campo" {...campo('comunidade')} /></div>
      <div><L id="d-tel" t="Telefone (WhatsApp)" /><input id="d-tel" type="tel" inputMode="tel" autoComplete="tel" className="campo" {...campo('telefone')} /></div>
      <div><L id="d-cid" t="Cidade" /><input id="d-cid" autoComplete="address-level2" className="campo" {...campo('cidade')} /></div>
      {erro && <p role="alert" className="rounded-cartao border border-cat-importante p-3 text-sm font-semibold text-cat-importante">{erro}</p>}
      {ok && <p role="status" className="rounded-cartao border border-cat-eventos p-3 font-semibold text-cat-eventos">Dados atualizados.</p>}
      <button type="submit" disabled={enviando} className="btn-primario w-full disabled:opacity-60">{enviando ? 'Salvando…' : 'Salvar alterações'}</button>
    </form>
  );
}
