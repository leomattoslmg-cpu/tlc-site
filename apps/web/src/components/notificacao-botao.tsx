'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { chamarPortal } from '@/lib/cliente';

type Estado = 'carregando' | 'sem-suporte' | 'instalar-ios' | 'bloqueado' | 'desligado' | 'ligado';

function chaveParaBytes(b64url: string): ArrayBuffer {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export function NotificacaoBotao() {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      const ua = navigator.userAgent;
      const ios = /iPhone|iPad|iPod/.test(ua);
      const instalado = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (ios && !instalado) return setEstado('instalar-ios');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setEstado('sem-suporte');
      if (Notification.permission === 'denied') return setEstado('bloqueado');
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sub = await reg.pushManager.getSubscription();
        setEstado(sub && Notification.permission === 'granted' ? 'ligado' : 'desligado');
      } catch {
        setEstado('sem-suporte');
      }
    })();
  }, []);

  async function ativar() {
    setErro('');
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setEstado(permissao === 'denied' ? 'bloqueado' : 'desligado');
        return;
      }
      const k = await chamarPortal('push/chave', 'GET');
      const chave = (k.dados as { chave?: string | null }).chave;
      if (!k.ok || !chave) throw new Error('chave');
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }));
      const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const r = await chamarPortal('push/inscrever', 'POST', { endpoint: j.endpoint, keys: { p256dh: j.keys?.p256dh, auth: j.keys?.auth } });
      if (!r.ok) throw new Error('inscrever');
      setEstado('ligado');
    } catch {
      setErro('Não foi possível ativar agora. Tente de novo em instantes.');
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setErro('');
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await chamarPortal('push/cancelar', 'POST', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setEstado('desligado');
    } catch {
      setErro('Não foi possível desativar agora.');
    } finally {
      setOcupado(false);
    }
  }

  if (estado === 'carregando' || estado === 'sem-suporte') return null;

  const base = 'cartao mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between';
  if (estado === 'instalar-ios') {
    return (
      <div className={base}>
        <p className="flex items-start gap-3"><BellRing className="mt-0.5 shrink-0 text-destaque" size={22} aria-hidden /> <span><strong>Receba os avisos no seu iPhone.</strong> Primeiro instale o app na tela inicial; depois volte aqui para ativar as notificações.</span></p>
        <a href="/instalar" className="btn-primario whitespace-nowrap">Como instalar</a>
      </div>
    );
  }
  if (estado === 'bloqueado') {
    return (
      <div className={base}>
        <p className="flex items-start gap-3"><BellOff className="mt-0.5 shrink-0 text-texto-apoio" size={22} aria-hidden /> <span>As notificações estão bloqueadas neste aparelho. Para receber os avisos, libere as notificações do TLC nos Ajustes do celular.</span></p>
      </div>
    );
  }
  return (
    <div className={base}>
      <p className="flex items-start gap-3">
        <BellRing className={`mt-0.5 shrink-0 ${estado === 'ligado' ? 'text-cat-eventos' : 'text-destaque'}`} size={22} aria-hidden />
        <span>{estado === 'ligado' ? <><strong>Avisos no celular: ativados.</strong> Você será avisado quando a coordenação publicar algo.</> : <><strong>Receba os avisos no celular.</strong> A coordenação publica e você é avisado na hora.</>}</span>
      </p>
      <div className="flex flex-col items-start gap-1">
        {estado === 'ligado' ? (
          <button type="button" onClick={desativar} disabled={ocupado} className="btn-secundario whitespace-nowrap disabled:opacity-60">{ocupado ? 'Aguarde…' : 'Desativar'}</button>
        ) : (
          <button type="button" onClick={ativar} disabled={ocupado} className="btn-primario whitespace-nowrap disabled:opacity-60">{ocupado ? 'Aguarde…' : 'Ativar avisos'}</button>
        )}
        {erro && <span role="alert" className="text-sm font-semibold text-cat-importante">{erro}</span>}
      </div>
    </div>
  );
}
