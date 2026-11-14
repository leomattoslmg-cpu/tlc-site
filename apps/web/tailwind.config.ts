import type { Config } from 'tailwindcss';

// As cores vêm de variáveis CSS (globals.css), então o modo escuro troca só os tokens.
const token = (nome: string) => `rgb(var(--${nome}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primaria: { DEFAULT: token('primaria'), forte: token('primaria-forte'), sobre: token('sobre-primaria') },
        destaque: token('destaque'),
        fundo: token('fundo'),
        superficie: token('superficie'),
        borda: token('borda'),
        texto: { DEFAULT: token('texto'), apoio: token('texto-apoio') },
        cat: {
          geral: token('cat-geral'),
          eventos: token('cat-eventos'),
          coordenacao: token('cat-coordenacao'),
          importante: token('cat-importante'),
        },
      },
      borderRadius: { cartao: '12px' },
      boxShadow: { cartao: '0 1px 2px rgb(31 41 51 / 0.06), 0 4px 12px rgb(31 41 51 / 0.06)' },
      fontFamily: { sans: ['var(--fonte)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
