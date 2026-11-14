const FUSO = 'America/Campo_Grande';

export function diaMes(iso: string): { dia: string; mes: string } {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: FUSO }).format(d);
  const mes = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: FUSO }).format(d).replace('.', '');
  return { dia, mes };
}

export function dataHoraLonga(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO,
  }).format(new Date(iso));
}

/** Quebra o texto das páginas em parágrafos (separados por linha em branco). Nunca injeta HTML. */
export function paragrafos(texto: string): string[] {
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
