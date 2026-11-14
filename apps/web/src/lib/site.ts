export const SITE_NOME = 'TLC Ponta Porã - MS';
export const SITE_LEMA = 'Treinamento de Liderança Cristã';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
export const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? '/portal/entrar';
export const CONTATO_EMAIL = process.env.NEXT_PUBLIC_CONTATO_EMAIL ?? '';
export const CONTATO_INSTAGRAM = process.env.NEXT_PUBLIC_CONTATO_INSTAGRAM ?? '';

export const MENU = [
  { href: '/', rotulo: 'Início' },
  { href: '/quem-somos', rotulo: 'Quem Somos' },
  { href: '/historia', rotulo: 'História' },
  { href: '/eventos', rotulo: 'Eventos' },
  { href: '/galeria', rotulo: 'Galeria' },
  { href: '/contato', rotulo: 'Contato' },
] as const;
