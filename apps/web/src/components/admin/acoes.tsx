'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { chamarPortal } from '@/lib/cliente';

/** Botão que chama a API, atualiza a página e mostra o erro, se houver. */
function Acao({ rotulo, ocupado, caminho, metodo = 'POST', corpo, confirmar, classe = 'btn-secundario' }: { rotulo: string; ocupado: string; caminho: string; metodo?: 'POST' | 'DELETE'; corpo?: unknown; confirmar?: string; classe?: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  async function executar() {
    if (confirmar && !window.confirm(confirmar)) return;
    setEnviando(true);
    setErro('');
    const r = await chamarPortal(caminho, metodo, corpo);
    setEnviando(false);
    if (!r.ok) return setErro(r.mensagem ?? 'Não foi possível concluir.');
    router.refresh();
  }
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={executar} disabled={enviando} className={`${classe} min-h-[44px] px-4 disabled:opacity-60`}>{enviando ? ocupado : rotulo}</button>
      {erro && <span role="alert" className="mt-1 text-sm font-semibold text-cat-importante">{erro}</span>}
    </span>
  );
}

export const CancelarEvento = ({ id }: { id: string }) => (
  <Acao rotulo="Cancelar evento" ocupado="Cancelando…" caminho={`eventos/${id}/cancelar`} confirmar="Cancelar este evento? A presença deixa de poder ser marcada." />
);
export const AprovarMembro = ({ id }: { id: string }) => <Acao rotulo="Aprovar" ocupado="Aprovando…" caminho={`membros-pendentes/${id}/aprovar`} classe="btn-primario" />;
export const RecusarMembro = ({ id }: { id: string }) => (
  <Acao rotulo="Recusar" ocupado="Recusando…" caminho={`membros-pendentes/${id}/recusar`} confirmar="Recusar este cadastro? A pessoa não conseguirá entrar." />
);
export const RevogarConvite = ({ id }: { id: string }) => (
  <Acao rotulo="Desativar QR" ocupado="Desativando…" caminho={`convites/${id}`} metodo="DELETE" confirmar="Desativar este QR Code de cadastro? Quem ainda não se cadastrou não poderá mais usá-lo." />
);

export function Imprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secundario nao-imprimir min-h-[44px] px-4">
      Imprimir cartaz
    </button>
  );
}

export function NovoConvite() {
  const router = useRouter();
  const [horas, setHoras] = useState('72');
  const [usos, setUsos] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  async function gerar(ev: React.FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    setErro('');
    const r = await chamarPortal('convites', 'POST', { validade_horas: Number(horas), max_usos: usos ? Number(usos) : null });
    setEnviando(false);
    if (!r.ok) return setErro(r.mensagem ?? 'Não foi possível gerar.');
    router.refresh();
  }
  return (
    <form onSubmit={gerar} className="cartao space-y-4 p-5">
      <h2 className="text-lg">Gerar QR Code de cadastro</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cv-h" className="mb-1 block font-semibold">Vale por</label>
          <select id="cv-h" className="campo" value={horas} onChange={(e) => setHoras(e.target.value)}>
            <option value="24">1 dia</option>
            <option value="72">3 dias</option>
            <option value="168">7 dias</option>
            <option value="720">30 dias</option>
          </select>
        </div>
        <div>
          <label htmlFor="cv-u" className="mb-1 block font-semibold">Limite de cadastros <span className="font-normal text-texto-apoio">(opcional)</span></label>
          <input id="cv-u" type="number" min={1} className="campo" value={usos} onChange={(e) => setUsos(e.target.value)} placeholder="Sem limite" />
        </div>
      </div>
      {erro && <p role="alert" className="font-semibold text-cat-importante">{erro}</p>}
      <button type="submit" disabled={enviando} className="btn-primario disabled:opacity-60">{enviando ? 'Gerando…' : 'Gerar QR Code'}</button>
    </form>
  );
}
