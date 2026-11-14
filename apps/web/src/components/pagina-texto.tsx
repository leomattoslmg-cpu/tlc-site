import { paragrafos } from '@/lib/format';
import { paginaPublica } from '@/lib/api';
import { EstadoVazio } from './estado-vazio';

/** Página de texto editável pelo painel (Quem Somos, História). */
export async function PaginaTexto({ slug, titulo }: { slug: string; titulo: string }) {
  const pagina = await paginaPublica(slug);
  return (
    <section className="container-tlc max-w-3xl py-12">
      <h1 className="text-3xl sm:text-4xl">{pagina?.titulo ?? titulo}</h1>
      <div className="mt-2 h-1 w-16 rounded bg-destaque" aria-hidden />
      {pagina ? (
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-texto">
          {paragrafos(pagina.conteudo).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EstadoVazio titulo="Conteúdo em preparação" texto="Estamos escrevendo esta página. Volte em breve ou fale com a gente." acao={{ href: '/contato', rotulo: 'Falar com o TLC' }} />
        </div>
      )}
    </section>
  );
}
