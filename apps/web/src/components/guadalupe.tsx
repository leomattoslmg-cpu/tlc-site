import fs from 'node:fs';
import path from 'node:path';
import Image from 'next/image';

const NOME = 'Nossa Senhora de Guadalupe';
const EXTENSOES = ['webp', 'jpg', 'jpeg', 'png'];

/** Procura a imagem oficial em public/guadalupe.(webp|jpg|jpeg|png). */
function imagemOficial(): string | null {
  for (const ext of EXTENSOES) {
    if (fs.existsSync(path.join(process.cwd(), 'public', `guadalupe.${ext}`))) return `/guadalupe.${ext}`;
  }
  return null;
}

// Estrelas do manto (posições no desenho de 200 x 280)
const ESTRELAS: [number, number][] = [
  [78, 100], [122, 100], [68, 135], [132, 135], [64, 172], [136, 172], [72, 208], [128, 208], [88, 120], [112, 120],
];
const RAIOS = Array.from({ length: 36 }, (_, i) => i * 10);

/**
 * Imagem de Nossa Senhora de Guadalupe, símbolo do TLC.
 * Se existir public/guadalupe.(webp|jpg|png), mostra essa imagem; senão, o emblema desenhado abaixo.
 * O tamanho vem da classe do pai (ex.: "h-10 w-8").
 */
export function Guadalupe({ className = 'h-64 w-60' }: { className?: string }) {
  const oficial = imagemOficial();
  if (oficial) {
    return (
      <div className={`relative ${className}`}>
        <Image src={oficial} alt={NOME} fill sizes="(min-width: 640px) 240px, 160px" className="object-contain" />
      </div>
    );
  }
  return (
    <svg viewBox="-30 0 260 280" role="img" aria-label={NOME} className={className}>
      <title>{NOME}</title>
      {/* Raios dourados e mandorla */}
      <g transform="translate(100 130)" stroke="#D4A024" strokeLinecap="round">
        {RAIOS.map((a) => (
          <line key={a} x1="0" y1="-84" x2="0" y2={a % 20 === 0 ? -128 : -112} strokeWidth={a % 20 === 0 ? 3 : 2} transform={`rotate(${a})`} />
        ))}
      </g>
      <ellipse cx="100" cy="132" rx="70" ry="108" fill="#F6E7B4" stroke="#D4A024" strokeWidth="2" />
      {/* Lua crescente aos pés */}
      <path d="M46 236 Q100 276 154 236 Q100 254 46 236Z" fill="#3B4A54" />
      {/* Manto azul-esverdeado com borda dourada */}
      <path d="M100 52 C70 56 58 90 54 140 C50 185 56 215 66 238 L134 238 C144 215 150 185 146 140 C142 90 130 56 100 52Z" fill="#2F7F86" stroke="#D4A024" strokeWidth="3" />
      {/* Túnica rosada */}
      <path d="M100 94 C86 98 80 132 78 182 L74 238 L126 238 L122 182 C120 132 114 98 100 94Z" fill="#C9847A" />
      <rect x="82" y="150" width="36" height="6" rx="3" fill="#8E4F55" />
      {/* Rosto e cabelo */}
      <ellipse cx="100" cy="80" rx="13" ry="16" fill="#E0B48C" />
      <path d="M86 80 C84 56 116 56 114 80 C110 68 90 68 86 80Z" fill="#3B2A20" />
      {/* Mãos postas */}
      <ellipse cx="100" cy="130" rx="6" ry="12" fill="#E0B48C" />
      {/* Estrelas do manto */}
      {ESTRELAS.map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 5} L${x + 1.6} ${y - 1.6} L${x + 5} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 5} L${x - 1.6} ${y + 1.6} L${x - 5} ${y} L${x - 1.6} ${y - 1.6}Z`} fill="#D4A024" />
      ))}
    </svg>
  );
}
