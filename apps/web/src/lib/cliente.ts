/** Chamadas do navegador ao proxy do portal (/api/portal/proxy/...). Devolve sempre uma mensagem pronta para mostrar. */
export async function chamarPortal(caminho: string, metodo: 'GET' | 'POST' | 'DELETE' = 'POST', corpo?: unknown) {
  try {
    const r = await fetch(`/api/portal/proxy/${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const d = r.status === 204 ? {} : await r.json().catch(() => ({}));
    const mensagem: string | undefined = d.mensagem || d.errors?.[0]?.mensagem || d.detail || d.title;
    return { ok: r.ok, status: r.status, dados: d, mensagem: r.ok ? undefined : mensagem || 'Não foi possível concluir. Tente de novo.' };
  } catch {
    return { ok: false, status: 0, dados: {}, mensagem: 'Sem conexão. Confira a internet e tente de novo.' };
  }
}
