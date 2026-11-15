/** Raios e brilho dourados que ficam atrás da imagem, como uma luz saindo de trás dela. Só decoração. */
export function LuzDourada() {
  return (
    <div aria-hidden className="luz">
      <div className="luz-brilho" />
      <div className="luz-raios" />
    </div>
  );
}
