'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { chamarPortal } from '@/lib/cliente';

export function NovoEventoForm() {
  const router = useRouter();
  const [v, setV] = useState({ nome: '', data: '', inicio: '19:00', fim: '22:00', local: '', descricao: '' });
  const [publico, setPublico] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function criar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    if (v.nome.trim().length < 3) return setErro('Informe o nome do evento.');
    if (!v.data) return setErro('Escolha o dia do evento.');
    if (v.fim < v.inicio) return setErro('O horário de fim precisa ser depois do início.');
    setEnviando(true);
    // Mato Grosso do Sul (Campo Grande): UTC-04:00, sem horário de verão.
    const r = await chamarPortal('eventos', 'POST', {
      nome: v.nome.trim(),
      descricao: v.descricao.trim() || undefined,
      inicio_em: `${v.data}T${v.inicio}:00-04:00`,
      fim_em: `${v.data}T${v.fim}:00-04:00`,
      local_nome: v.local.trim() || undefined,
      publico_no_site: publico,
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.mensagem ?? 'Não foi possível criar.');
    router.push(`/portal/admin/eventos/${r.dados.id}`);
  }

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form onSubmit={criar} noValidate className="cartao space-y-4 p-5">
      <h2 className="text-lg">Novo evento</h2>
      <div><label htmlFor="ev-nome" className="mb-1 block font-semibold">Nome</label><input id="ev-nome" className="campo" value={v.nome} onChange={set('nome')} placeholder="Ex.: Formação de líderes" /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label htmlFor="ev-data" className="mb-1 block font-semibold">Dia</label><input id="ev-data" type="date" className="campo" value={v.data} onChange={set('data')} /></div>
        <div><label htmlFor="ev-ini" className="mb-1 block font-semibold">Início</label><input id="ev-ini" type="time" className="campo" value={v.inicio} onChange={set('inicio')} /></div>
        <div><label htmlFor="ev-fim" className="mb-1 block font-semibold">Fim</label><input id="ev-fim" type="time" className="campo" value={v.fim} onChange={set('fim')} /></div>
      </div>
      <div><label htmlFor="ev-local" className="mb-1 block font-semibold">Local <span className="font-normal text-texto-apoio">(opcional)</span></label><input id="ev-local" className="campo" value={v.local} onChange={set('local')} /></div>
      <div><label htmlFor="ev-desc" className="mb-1 block font-semibold">Descrição <span className="font-normal text-texto-apoio">(opcional)</span></label><textarea id="ev-desc" rows={3} className="campo py-3" value={v.descricao} onChange={set('descricao')} /></div>
      <label className="flex items-center gap-3"><input type="checkbox" checked={publico} onChange={(e) => setPublico(e.target.checked)} className="h-5 w-5" /> Mostrar este evento no site público</label>
      {erro && <p role="alert" className="font-semibold text-cat-importante">{erro}</p>}
      <button type="submit" disabled={enviando} className="btn-primario disabled:opacity-60">{enviando ? 'Criando…' : 'Criar evento e gerar QR Code'}</button>
    </form>
  );
}
