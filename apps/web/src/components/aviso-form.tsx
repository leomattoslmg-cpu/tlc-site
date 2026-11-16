'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { chamarPortal } from '@/lib/cliente';

export interface AvisoEditavel {
  titulo: string;
  conteudo: string;
  categoria: string;
  publico_alvo: string;
  fixado: boolean;
  status: string;
}

const CATEGORIAS = [
  { v: 'geral', t: 'Geral' },
  { v: 'eventos', t: 'Eventos' },
  { v: 'coordenacao', t: 'Coordenação' },
  { v: 'importante', t: 'Importante' },
];

export function AvisoForm({ id, inicial }: { id?: string; inicial?: AvisoEditavel }) {
  const router = useRouter();
  const [v, setV] = useState<AvisoEditavel>(inicial ?? { titulo: '', conteudo: '', categoria: 'geral', publico_alvo: 'membros', fixado: false, status: 'publicado' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    if (v.titulo.trim().length < 3) return setErro('Informe o título do aviso.');
    if (v.conteudo.trim().length < 3) return setErro('Escreva o texto do aviso.');
    setEnviando(true);
    const corpo = { titulo: v.titulo.trim(), conteudo: v.conteudo.trim(), categoria: v.categoria, publico_alvo: v.publico_alvo, fixado: v.fixado, status: v.status };
    const r = id ? await chamarPortal(`avisos/${id}`, 'PATCH', corpo) : await chamarPortal('avisos', 'POST', corpo);
    setEnviando(false);
    if (!r.ok) return setErro(r.mensagem ?? 'Não foi possível salvar.');
    router.push('/portal/avisos');
    router.refresh();
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <div>
        <label htmlFor="av-titulo" className="mb-1 block font-semibold">Título</label>
        <input id="av-titulo" maxLength={120} className="campo" value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })} placeholder="Ex.: Retiro de formação dia 13/12" />
      </div>
      <div>
        <label htmlFor="av-texto" className="mb-1 block font-semibold">Texto do aviso</label>
        <textarea id="av-texto" rows={8} maxLength={5000} className="campo py-3 leading-relaxed" value={v.conteudo} onChange={(e) => setV({ ...v, conteudo: e.target.value })} placeholder="Escreva aqui. Deixe uma linha em branco para separar os parágrafos." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="av-cat" className="mb-1 block font-semibold">Categoria</label>
          <select id="av-cat" className="campo" value={v.categoria} onChange={(e) => setV({ ...v, categoria: e.target.value })}>
            {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="av-alvo" className="mb-1 block font-semibold">Quem vê</label>
          <select id="av-alvo" className="campo" value={v.publico_alvo} onChange={(e) => setV({ ...v, publico_alvo: e.target.value })}>
            <option value="membros">Todos os membros</option>
            <option value="coordenacao">Só a coordenação</option>
          </select>
        </div>
      </div>
      <label className="flex min-h-[44px] items-center gap-3">
        <input type="checkbox" className="h-5 w-5" checked={v.fixado} onChange={(e) => setV({ ...v, fixado: e.target.checked })} />
        <span>Fixar no topo da lista</span>
      </label>
      {id && (
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={v.status === 'arquivado'} onChange={(e) => setV({ ...v, status: e.target.checked ? 'arquivado' : 'publicado' })} />
          <span>Arquivar (esconde o aviso dos membros)</span>
        </label>
      )}
      {erro && <p role="alert" className="rounded-cartao border border-cat-importante p-3 text-sm font-semibold text-cat-importante">{erro}</p>}
      <button type="submit" disabled={enviando} className="btn-primario w-full disabled:opacity-60">{enviando ? 'Salvando…' : id ? 'Salvar alterações' : 'Publicar aviso'}</button>
    </form>
  );
}
