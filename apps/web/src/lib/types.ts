// Tipos espelham os esquemas Evento, Album e PaginaSite do OpenAPI (docs/03-openapi.yaml).
export type EventoStatus = 'rascunho' | 'inscricoes_abertas' | 'esgotado' | 'encerrado' | 'cancelado';

export interface Evento {
  id: string;
  nome: string;
  descricao: string | null;
  inicio_em: string;
  fim_em: string;
  local_nome: string | null;
  local_endereco: string | null;
  imagem_url: string | null;
  status: EventoStatus;
}

export interface Album {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  total_fotos: number;
  criado_em: string;
}

export interface PaginaSite {
  slug: string;
  titulo: string;
  conteudo: string;
  publicado: boolean;
  atualizado_em: string;
}
