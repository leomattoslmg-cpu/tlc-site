import { paragrafos } from '@/lib/format';
import { paginaPublica } from '@/lib/api';
import { EstadoVazio } from './estado-vazio';

interface Fonte {
  rotulo: string;
  href: string;
}

/**
 * Página de texto editável pelo painel (Quem Somos, História).
 * Se o painel ainda não tem o texto (ou a API está fora do ar), mostra o texto "padrao" escrito aqui.
 */
export async function PaginaTexto({ slug, titulo, padrao, fontes }: { slug: string; titulo: string; padrao?: string[]; fontes?: Fonte[] }) {
  const pagina = await paginaPublica(slug);
  const texto = pagina ? paragrafos(pagina.conteudo) : (padrao ?? null);
  return (
    <section className="container-tlc max-w-3xl py-12">
      <h1 className="text-3xl sm:text-4xl">{pagina?.titulo ?? titulo}</h1>
      <div className="mt-2 h-1 w-16 rounded bg-destaque" aria-hidden />
      {texto ? (
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-texto">
          {texto.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {!pagina && fontes && fontes.length > 0 && (
            <p className="pt-4 text-sm text-texto-apoio">
              Fontes:{' '}
              {fontes.map((f, i) => (
                <span key={f.href}>
                  {i > 0 && ' · '}
                  <a href={f.href} target="_blank" rel="noopener noreferrer" className="underline">
                    {f.rotulo}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-8">
          <EstadoVazio titulo="Conteúdo em preparação" texto="Estamos escrevendo esta página. Volte em breve ou fale com a gente." acao={{ href: '/contato', rotulo: 'Falar com o TLC' }} />
        </div>
      )}
    </section>
  );
}
