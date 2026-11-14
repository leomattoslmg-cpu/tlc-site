-- =============================================================================
-- TLC Ponta Porã - MS · Esquema do banco de dados (PostgreSQL 15 ou superior)
-- Gerado a partir da seção "2. Estrutura do banco de dados" da especificação.
--
-- Convenções
--   * Chaves UUID v7 (função uuid_v7(), ordenável por data de criação).
--   * Datas em UTC (timestamptz); a exibição em America/Campo_Grande é da aplicação.
--   * CPF nunca é gravado em claro: cpf_cifrado (AES-256-GCM, feito pela API)
--     e cpf_hash (HMAC-SHA-256, para busca, login e unicidade).
--   * Exclusão lógica (excluido_em) nas tabelas de conteúdo.
--   * Binários ficam no storage; o banco guarda só a chave em "arquivos".
--
-- Uso:  psql -v ON_ERROR_STOP=1 -d tlc -f schema.sql
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- busca de membros por nome
CREATE EXTENSION IF NOT EXISTS citext;    -- e-mails sem diferença de maiúsculas

-- -----------------------------------------------------------------------------
-- Funções de apoio
-- -----------------------------------------------------------------------------

-- UUID v7 (48 bits de milissegundos + aleatório). No PostgreSQL 18 pode-se usar uuidv7().
CREATE OR REPLACE FUNCTION uuid_v7() RETURNS uuid
LANGUAGE sql VOLATILE AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
                PLACING substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                FROM 1 FOR 6),
        52, 1),
      53, 1),
    'hex')::uuid
$$;

CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END $$;

-- -----------------------------------------------------------------------------
-- Domínio 1 · Organização e acesso
-- -----------------------------------------------------------------------------

CREATE TABLE organizacoes (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  nome             text        NOT NULL,
  slug             text        NOT NULL UNIQUE,
  cidade           text,
  uf               char(2),
  logo_arquivo_id  uuid,                        -- FK adicionada depois (arquivos)
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);

-- Domínio 9 (criada cedo porque várias tabelas apontam para ela)
CREATE TABLE arquivos (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id   uuid        NOT NULL REFERENCES organizacoes(id),
  chave_storage    text        NOT NULL UNIQUE,
  nome_original    text        NOT NULL,
  mime             text        NOT NULL,
  tamanho_bytes    bigint      NOT NULL CHECK (tamanho_bytes >= 0),
  hash_sha256      text,
  confirmado_em    timestamptz,                 -- preenchido em /arquivos/{id}/confirmar
  enviado_por      uuid,                        -- FK adicionada depois (usuarios)
  criado_em        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE igrejas (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id   uuid        NOT NULL REFERENCES organizacoes(id),
  nome             text        NOT NULL,
  pastor           text,
  cidade           text,
  telefone         text,
  ativa            boolean     NOT NULL DEFAULT true,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now(),
  excluido_em      timestamptz,
  UNIQUE (organizacao_id, nome)
);

CREATE TABLE usuarios (
  id                   uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id       uuid        NOT NULL REFERENCES organizacoes(id),
  email                citext      NOT NULL,
  senha_hash           text,                    -- argon2id; nulo até aceitar o convite
  status               text        NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente','ativo','bloqueado','inativo')),
  email_verificado_em  timestamptz,
  ultimo_login_em      timestamptz,
  tentativas_falhas    smallint    NOT NULL DEFAULT 0,   -- RN-AUT-04
  bloqueado_ate        timestamptz,                      -- RN-AUT-04 (15 minutos)
  criado_em            timestamptz NOT NULL DEFAULT now(),
  atualizado_em        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, email)
);

ALTER TABLE arquivos
  ADD CONSTRAINT arquivos_enviado_por_fk FOREIGN KEY (enviado_por) REFERENCES usuarios(id);
ALTER TABLE organizacoes
  ADD CONSTRAINT organizacoes_logo_fk FOREIGN KEY (logo_arquivo_id) REFERENCES arquivos(id);

CREATE TABLE perfis (
  id      uuid PRIMARY KEY DEFAULT uuid_v7(),
  codigo  text     NOT NULL UNIQUE,
  nome    text     NOT NULL,
  nivel   smallint NOT NULL CHECK (nivel BETWEEN 1 AND 5)
);

CREATE TABLE usuario_perfis (
  usuario_id    uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  perfil_id     uuid        NOT NULL REFERENCES perfis(id),
  atribuido_por uuid        REFERENCES usuarios(id),
  atribuido_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, perfil_id)
);

CREATE TABLE permissoes (
  id       uuid PRIMARY KEY DEFAULT uuid_v7(),
  recurso  text NOT NULL,
  acao     text NOT NULL,
  UNIQUE (recurso, acao)
);

CREATE TABLE perfil_permissoes (
  perfil_id     uuid NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  permissao_id  uuid NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
  PRIMARY KEY (perfil_id, permissao_id)
);

CREATE TABLE sessoes (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  usuario_id    uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash    text        NOT NULL UNIQUE,    -- refresh token com rotação (RN-AUT-07)
  dispositivo   text,
  ip            inet,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  expira_em     timestamptz NOT NULL,
  revogado_em   timestamptz
);

CREATE TABLE recuperacoes_senha (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  usuario_id  uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  text        NOT NULL UNIQUE,      -- uso único, validade de 60 minutos (RN-AUT-05)
  criado_em   timestamptz NOT NULL DEFAULT now(),
  expira_em   timestamptz NOT NULL,
  usado_em    timestamptz
);

-- -----------------------------------------------------------------------------
-- Domínio 2 · Membros
-- -----------------------------------------------------------------------------

CREATE TABLE turmas (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id  uuid        NOT NULL REFERENCES organizacoes(id),
  nome            text        NOT NULL,
  ano             smallint,
  data_inicio     date,
  data_fim        date,
  status          text        NOT NULL DEFAULT 'planejada'
                  CHECK (status IN ('planejada','em_andamento','encerrada')),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio)
);

CREATE TABLE membros (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id   uuid        NOT NULL REFERENCES organizacoes(id),
  usuario_id       uuid        UNIQUE REFERENCES usuarios(id),   -- opcional (membro sem login)
  igreja_id        uuid        NOT NULL REFERENCES igrejas(id),
  nome_completo    text        NOT NULL,
  foto_arquivo_id  uuid        REFERENCES arquivos(id),
  cpf_cifrado      bytea,                       -- nulo só para menor de 18 anos sem CPF (RN-MEM-10)
  cpf_hash         bytea,
  data_nascimento  date        NOT NULL,
  telefone         text,                        -- E.164
  whatsapp         text,                        -- E.164
  email            citext,
  cep              text,
  logradouro       text,
  numero           text,
  complemento      text,
  bairro           text,
  cidade           text,
  uf               char(2),
  observacoes      text,                        -- campo interno (RN-MEM-06)
  status           text        NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('ativo','inativo','pendente')),
  data_ingresso    date,
  termo_aceito_em  timestamptz,                 -- RN-MEM-08
  termo_versao     text,
  anonimizado_em   timestamptz,                 -- RN-MEM-04
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now(),
  excluido_em      timestamptz,
  UNIQUE (organizacao_id, cpf_hash),            -- RN-AUT-02 (valores nulos não colidem)
  CHECK ((cpf_cifrado IS NULL) = (cpf_hash IS NULL)),
  CHECK (anonimizado_em IS NOT NULL OR telefone IS NOT NULL OR whatsapp IS NOT NULL)  -- RN-MEM-01
);

-- Regras de idade que dependem da data de hoje (não cabem em CHECK):
--   * idade mínima de 13 anos (RN-MEM-09);
--   * CPF obrigatório a partir dos 18 anos (RN-MEM-10).
CREATE OR REPLACE FUNCTION membros_regras_idade() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.anonimizado_em IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.data_nascimento > (current_date - INTERVAL '13 years')::date THEN
    RAISE EXCEPTION 'Idade mínima de 13 anos não atendida' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.cpf_cifrado IS NULL AND NEW.data_nascimento <= (current_date - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'CPF é obrigatório para maiores de 18 anos' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER membros_regras_idade_trg
  BEFORE INSERT OR UPDATE OF data_nascimento, cpf_cifrado, anonimizado_em ON membros
  FOR EACH ROW EXECUTE FUNCTION membros_regras_idade();

CREATE TABLE membro_historico (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  membro_id        uuid        NOT NULL REFERENCES membros(id),
  tipo             text        NOT NULL
                   CHECK (tipo IN ('cadastro','mudanca_igreja','turma','evento','perfil','status','observacao')),
  descricao        text        NOT NULL,
  referencia_tipo  text,
  referencia_id    uuid,
  criado_por       uuid        REFERENCES usuarios(id),
  criado_em        timestamptz NOT NULL DEFAULT now()
);

-- O histórico só recebe novas linhas (RN-MEM-05).
CREATE OR REPLACE FUNCTION bloquear_alteracao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'A tabela % aceita apenas inserções', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER membro_historico_somente_insercao
  BEFORE UPDATE OR DELETE ON membro_historico
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();

CREATE TABLE membro_turmas (
  membro_id  uuid NOT NULL REFERENCES membros(id),
  turma_id   uuid NOT NULL REFERENCES turmas(id),
  papel      text NOT NULL DEFAULT 'aluno'
             CHECK (papel IN ('aluno','facilitador','coordenador')),
  situacao   text NOT NULL DEFAULT 'cursando'
             CHECK (situacao IN ('cursando','concluido','desistente')),
  criado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membro_id, turma_id)
);

-- -----------------------------------------------------------------------------
-- Domínio 3 · Mural de avisos
-- -----------------------------------------------------------------------------

CREATE TABLE categorias_aviso (
  id    uuid PRIMARY KEY DEFAULT uuid_v7(),
  nome  text NOT NULL UNIQUE,
  slug  text NOT NULL UNIQUE,
  cor   text NOT NULL CHECK (cor ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE avisos (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id     uuid        NOT NULL REFERENCES organizacoes(id),
  titulo             text        NOT NULL,
  conteudo           text        NOT NULL,
  imagem_arquivo_id  uuid        REFERENCES arquivos(id),
  categoria_id       uuid        NOT NULL REFERENCES categorias_aviso(id),
  autor_id           uuid        NOT NULL REFERENCES usuarios(id),
  status             text        NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho','agendado','publicado','arquivado')),
  fixado             boolean     NOT NULL DEFAULT false,
  publico_alvo       text        NOT NULL DEFAULT 'todos'
                     CHECK (publico_alvo IN ('todos','membros','coordenacao')),
  publicar_em        timestamptz,
  expira_em          timestamptz,
  editado_em         timestamptz,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_em      timestamptz NOT NULL DEFAULT now(),
  excluido_em        timestamptz,
  CHECK (expira_em IS NULL OR publicar_em IS NULL OR expira_em > publicar_em)
);

CREATE TABLE aviso_comentarios (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  aviso_id       uuid        NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  usuario_id     uuid        NOT NULL REFERENCES usuarios(id),
  parent_id      uuid        REFERENCES aviso_comentarios(id),   -- respostas de um nível
  texto          text        NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 1000),   -- RN-AVI-05
  status         text        NOT NULL DEFAULT 'visivel'
                 CHECK (status IN ('visivel','oculto','removido')),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE aviso_reacoes (
  aviso_id    uuid        NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  usuario_id  uuid        NOT NULL REFERENCES usuarios(id),
  tipo        text        NOT NULL CHECK (tipo IN ('curtir','amem','orar','celebrar')),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aviso_id, usuario_id)            -- uma reação por pessoa (RN-AVI-06)
);

CREATE TABLE aviso_leituras (
  aviso_id    uuid        NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  usuario_id  uuid        NOT NULL REFERENCES usuarios(id),
  lido_em     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aviso_id, usuario_id)
);

-- -----------------------------------------------------------------------------
-- Domínio 4 · Eventos
-- -----------------------------------------------------------------------------

CREATE TABLE eventos (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id     uuid        NOT NULL REFERENCES organizacoes(id),
  nome               text        NOT NULL,
  descricao          text,
  inicio_em          timestamptz NOT NULL,
  fim_em             timestamptz NOT NULL,
  local_nome         text,
  local_endereco     text,
  imagem_arquivo_id  uuid        REFERENCES arquivos(id),
  capacidade         integer     CHECK (capacidade IS NULL OR capacidade > 0),   -- nulo = sem limite
  status             text        NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho','inscricoes_abertas','esgotado','encerrado','cancelado')),
  publico_no_site    boolean     NOT NULL DEFAULT false,
  exige_inscricao    boolean     NOT NULL DEFAULT true,
  turma_id           uuid        REFERENCES turmas(id),
  criado_por         uuid        NOT NULL REFERENCES usuarios(id),
  criado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_em      timestamptz NOT NULL DEFAULT now(),
  excluido_em        timestamptz,
  CHECK (fim_em >= inicio_em)
);

CREATE TABLE evento_inscricoes (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  evento_id     uuid        NOT NULL REFERENCES eventos(id),
  membro_id     uuid        NOT NULL REFERENCES membros(id),
  status        text        NOT NULL DEFAULT 'confirmada'
                CHECK (status IN ('confirmada','lista_espera','cancelada')),
  qr_token      text        NOT NULL UNIQUE,    -- token assinado (RN-EVE-04)
  inscrito_em   timestamptz NOT NULL DEFAULT now(),
  cancelada_em  timestamptz,
  UNIQUE (evento_id, membro_id)
);

CREATE TABLE evento_checkins (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  evento_id      uuid        NOT NULL REFERENCES eventos(id),
  membro_id      uuid        NOT NULL REFERENCES membros(id),
  metodo         text        NOT NULL CHECK (metodo IN ('qr','manual')),
  registrado_por uuid        NOT NULL REFERENCES usuarios(id),
  registrado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, membro_id)                 -- impede check-in duplicado (RN-EVE-05)
);

-- -----------------------------------------------------------------------------
-- Domínio 5 · Galeria
-- -----------------------------------------------------------------------------

CREATE TABLE albuns (
  id                              uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id                  uuid        NOT NULL REFERENCES organizacoes(id),
  titulo                          text        NOT NULL,
  descricao                       text,
  evento_id                       uuid        REFERENCES eventos(id),   -- nulo = álbum avulso
  capa_foto_id                    uuid,                                  -- FK adicionada depois (fotos)
  visibilidade                    text        NOT NULL DEFAULT 'membros'
                                  CHECK (visibilidade IN ('publico','membros')),
  autorizacao_imagem_confirmada   boolean     NOT NULL DEFAULT false,
  status                          text        NOT NULL DEFAULT 'rascunho'
                                  CHECK (status IN ('rascunho','publicado','arquivado')),
  criado_por                      uuid        NOT NULL REFERENCES usuarios(id),
  criado_em                       timestamptz NOT NULL DEFAULT now(),
  atualizado_em                   timestamptz NOT NULL DEFAULT now(),
  excluido_em                     timestamptz,
  -- Álbum público exige confirmação de autorização de imagem (RN-GAL-02)
  CHECK (visibilidade <> 'publico' OR autorizacao_imagem_confirmada)
);

CREATE TABLE fotos (
  id                       uuid PRIMARY KEY DEFAULT uuid_v7(),
  album_id                 uuid        NOT NULL REFERENCES albuns(id),
  arquivo_id               uuid        NOT NULL REFERENCES arquivos(id),
  miniatura_arquivo_id     uuid        REFERENCES arquivos(id),
  legenda                  text,
  largura                  integer,
  altura                   integer,
  ordem                    integer     NOT NULL DEFAULT 0,
  enviado_por              uuid        NOT NULL REFERENCES usuarios(id),
  criado_em                timestamptz NOT NULL DEFAULT now(),
  excluido_em              timestamptz
);

ALTER TABLE albuns
  ADD CONSTRAINT albuns_capa_fk FOREIGN KEY (capa_foto_id) REFERENCES fotos(id);

-- -----------------------------------------------------------------------------
-- Domínio 6 · Documentos
-- -----------------------------------------------------------------------------

CREATE TABLE categorias_documento (
  id    uuid PRIMARY KEY DEFAULT uuid_v7(),
  nome  text NOT NULL UNIQUE
);

CREATE TABLE documentos (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id  uuid        NOT NULL REFERENCES organizacoes(id),
  titulo          text        NOT NULL,
  descricao       text,
  categoria_id    uuid        NOT NULL REFERENCES categorias_documento(id),
  arquivo_id      uuid        NOT NULL REFERENCES arquivos(id),
  versao          integer     NOT NULL DEFAULT 1 CHECK (versao >= 1),
  publicado_em    timestamptz,
  criado_por      uuid        NOT NULL REFERENCES usuarios(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  excluido_em     timestamptz
);

-- Sem linhas aqui, o documento fica visível a todos os autenticados (RN-DOC-02).
CREATE TABLE documento_perfis (
  documento_id  uuid NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  perfil_id     uuid NOT NULL REFERENCES perfis(id),
  PRIMARY KEY (documento_id, perfil_id)
);

CREATE TABLE documento_downloads (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  documento_id  uuid        NOT NULL REFERENCES documentos(id),
  usuario_id    uuid        NOT NULL REFERENCES usuarios(id),
  versao        integer     NOT NULL,
  baixado_em    timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Domínio 7 · Notificações
-- -----------------------------------------------------------------------------

CREATE TABLE notificacoes (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id  uuid        NOT NULL REFERENCES organizacoes(id),
  tipo            text        NOT NULL,         -- ex.: aviso.importante, evento.cancelado
  titulo          text        NOT NULL,
  corpo           text        NOT NULL,
  dados           jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- inclui o link profundo
  origem_tipo     text,
  origem_id       uuid,
  prioridade      text        NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa','normal','alta')),
  segmento        jsonb,
  enviar_em       timestamptz NOT NULL DEFAULT now(),
  status          text        NOT NULL DEFAULT 'agendada'
                  CHECK (status IN ('agendada','enfileirada','enviada','falhou','cancelada')),
  criado_por      uuid        REFERENCES usuarios(id),
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notificacao_destinatarios (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  notificacao_id  uuid        NOT NULL REFERENCES notificacoes(id) ON DELETE CASCADE,
  usuario_id      uuid        NOT NULL REFERENCES usuarios(id),
  push_status     text        NOT NULL DEFAULT 'pendente'
                  CHECK (push_status IN ('nao_aplicavel','pendente','enviado','entregue','falhou')),
  lida_em         timestamptz,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notificacao_id, usuario_id)           -- sem duplicidade
);

CREATE TABLE dispositivos (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  usuario_id    uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  plataforma    text        NOT NULL CHECK (plataforma IN ('android','ios','web')),
  push_token    text        NOT NULL UNIQUE,
  app_versao    text,
  ativo         boolean     NOT NULL DEFAULT true,
  ultimo_uso_em timestamptz,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE preferencias_notificacao (
  usuario_id  uuid    NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        text    NOT NULL,
  push        boolean NOT NULL DEFAULT true,
  email       boolean NOT NULL DEFAULT false,
  no_app      boolean NOT NULL DEFAULT true,
  PRIMARY KEY (usuario_id, tipo)
);

-- -----------------------------------------------------------------------------
-- Domínio 8 · Site institucional
-- -----------------------------------------------------------------------------

CREATE TABLE paginas_site (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id  uuid        NOT NULL REFERENCES organizacoes(id),
  slug            text        NOT NULL,
  titulo          text        NOT NULL,
  conteudo        text        NOT NULL DEFAULT '',
  publicado       boolean     NOT NULL DEFAULT false,
  atualizado_por  uuid        REFERENCES usuarios(id),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, slug)
);

CREATE TABLE mensagens_contato (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id  uuid        NOT NULL REFERENCES organizacoes(id),
  nome            text        NOT NULL,
  email           citext      NOT NULL,
  telefone        text,
  assunto         text        NOT NULL,
  mensagem        text        NOT NULL,
  status          text        NOT NULL DEFAULT 'nova'
                  CHECK (status IN ('nova','em_atendimento','respondida')),
  respondido_por  uuid        REFERENCES usuarios(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  respondido_em   timestamptz
);

-- -----------------------------------------------------------------------------
-- Domínio 9 · Sistema (auditoria)
-- -----------------------------------------------------------------------------

CREATE TABLE auditoria (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id  uuid        REFERENCES organizacoes(id),
  usuario_id      uuid        REFERENCES usuarios(id),   -- sem exclusão em cascata
  acao            text        NOT NULL,                  -- ex.: cpf.visualizar, membro.excluir
  entidade        text        NOT NULL,
  entidade_id     uuid,
  antes           jsonb,
  depois          jsonb,
  ip              inet,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER auditoria_somente_insercao
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------

CREATE INDEX membros_nome_trgm_idx     ON membros USING gin (nome_completo gin_trgm_ops);
CREATE INDEX membros_org_status_idx    ON membros (organizacao_id, status) WHERE excluido_em IS NULL;
CREATE INDEX membros_igreja_idx        ON membros (igreja_id);
CREATE INDEX membro_historico_idx      ON membro_historico (membro_id, criado_em DESC);
CREATE INDEX membro_turmas_turma_idx   ON membro_turmas (turma_id);

CREATE INDEX avisos_publicar_idx       ON avisos (organizacao_id, publicar_em DESC) WHERE excluido_em IS NULL;
CREATE INDEX avisos_categoria_idx      ON avisos (categoria_id);
CREATE INDEX aviso_comentarios_idx     ON aviso_comentarios (aviso_id, criado_em);

CREATE INDEX eventos_inicio_idx        ON eventos (organizacao_id, inicio_em) WHERE excluido_em IS NULL;
CREATE INDEX eventos_status_idx        ON eventos (status);
CREATE INDEX evento_inscricoes_membro  ON evento_inscricoes (membro_id);
CREATE INDEX evento_inscricoes_status  ON evento_inscricoes (evento_id, status);

CREATE INDEX albuns_evento_idx         ON albuns (evento_id);
CREATE INDEX fotos_album_idx           ON fotos (album_id, ordem) WHERE excluido_em IS NULL;

CREATE INDEX documentos_categoria_idx  ON documentos (categoria_id) WHERE excluido_em IS NULL;
CREATE INDEX documento_downloads_idx   ON documento_downloads (documento_id, baixado_em DESC);

CREATE INDEX notif_dest_usuario_idx    ON notificacao_destinatarios (usuario_id, lida_em, criado_em DESC);
CREATE INDEX notificacoes_enviar_idx   ON notificacoes (status, enviar_em);
CREATE INDEX dispositivos_usuario_idx  ON dispositivos (usuario_id) WHERE ativo;

CREATE INDEX sessoes_usuario_idx       ON sessoes (usuario_id) WHERE revogado_em IS NULL;
CREATE INDEX auditoria_entidade_idx    ON auditoria (entidade, entidade_id, criado_em DESC);
CREATE INDEX auditoria_usuario_idx     ON auditoria (usuario_id, criado_em DESC);

-- -----------------------------------------------------------------------------
-- Gatilhos de atualizado_em
-- -----------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizacoes','igrejas','usuarios','turmas','membros','avisos',
                           'aviso_comentarios','eventos','albuns','documentos','paginas_site']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_atualizado_em()',
      t || '_atualizado_em', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Dados iniciais (seed)
-- -----------------------------------------------------------------------------

INSERT INTO organizacoes (nome, slug, cidade, uf)
VALUES ('TLC Ponta Porã - MS', 'tlc-ponta-pora', 'Ponta Porã', 'MS');

INSERT INTO perfis (codigo, nome, nivel) VALUES
  ('super_admin', 'Super Administrador', 5),
  ('admin',       'Administrador',       4),
  ('coordenador', 'Coordenador',         3),
  ('secretaria',  'Secretaria',          3),
  ('membro',      'Membro',              2),
  ('visitante',   'Visitante',           1);

INSERT INTO categorias_aviso (nome, slug, cor) VALUES
  ('Geral',        'geral',        '#52606D'),
  ('Eventos',      'eventos',      '#1B7F4B'),
  ('Coordenação',  'coordenacao',  '#6B3FA0'),
  ('Importante',   'importante',   '#B42318');

INSERT INTO categorias_documento (nome) VALUES
  ('Regulamentos'), ('Apostilas'), ('Comunicados'), ('Outros');

INSERT INTO permissoes (recurso, acao) VALUES
  ('administradores', 'gerir'),
  ('usuarios',        'ler'),
  ('usuarios',        'atribuir_perfil'),
  ('usuarios',        'aprovar'),
  ('usuarios',        'redefinir_senha'),
  ('membros',         'ler'),
  ('membros',         'criar'),
  ('membros',         'editar'),
  ('membros',         'excluir'),
  ('membros',         'ver_cpf'),
  ('membros',         'ver_observacoes'),
  ('cadastros',       'gerir'),
  ('avisos',          'ler'),
  ('avisos',          'publicar'),
  ('avisos',          'excluir'),
  ('avisos',          'comentar'),
  ('comentarios',     'moderar'),
  ('eventos',         'ler'),
  ('eventos',         'criar'),
  ('eventos',         'editar'),
  ('eventos',         'inscrever'),
  ('eventos',         'participantes'),
  ('eventos',         'checkin'),
  ('eventos',         'exportar'),
  ('galeria',         'ler'),
  ('galeria',         'enviar'),
  ('galeria',         'excluir'),
  ('galeria',         'excluir_proprio'),
  ('documentos',      'ler'),
  ('documentos',      'gerir'),
  ('notificacoes',    'enviar'),
  ('dashboard',       'ler'),
  ('site',            'editar'),
  ('contato',         'responder'),
  ('auditoria',       'ler');

-- Matriz de permissões (seção 8 da especificação).
-- Super Administrador: tudo.
INSERT INTO perfil_permissoes (perfil_id, permissao_id)
SELECT (SELECT id FROM perfis WHERE codigo = 'super_admin'), id FROM permissoes;

-- Administrador: tudo, menos gerir administradores, anonimizar membros e consultar a auditoria.
INSERT INTO perfil_permissoes (perfil_id, permissao_id)
SELECT (SELECT id FROM perfis WHERE codigo = 'admin'), id FROM permissoes
WHERE recurso || ':' || acao NOT IN ('administradores:gerir', 'membros:excluir', 'auditoria:ler');

-- Coordenador: conteúdo e atividades; vê membros sem CPF nem observações.
INSERT INTO perfil_permissoes (perfil_id, permissao_id)
SELECT (SELECT id FROM perfis WHERE codigo = 'coordenador'), id FROM permissoes
WHERE recurso || ':' || acao IN (
  'membros:ler',
  'avisos:ler', 'avisos:publicar', 'avisos:comentar', 'comentarios:moderar',
  'eventos:ler', 'eventos:criar', 'eventos:editar', 'eventos:inscrever',
  'eventos:participantes', 'eventos:checkin', 'eventos:exportar',
  'galeria:ler', 'galeria:enviar', 'galeria:excluir_proprio',
  'documentos:ler', 'documentos:gerir',
  'notificacoes:enviar', 'dashboard:ler', 'site:editar');

-- Secretaria: rotina administrativa; CPF só mascarado (sem membros:ver_cpf).
INSERT INTO perfil_permissoes (perfil_id, permissao_id)
SELECT (SELECT id FROM perfis WHERE codigo = 'secretaria'), id FROM permissoes
WHERE recurso || ':' || acao IN (
  'usuarios:aprovar', 'usuarios:redefinir_senha',
  'membros:ler', 'membros:criar', 'membros:editar', 'membros:ver_observacoes',
  'avisos:ler', 'avisos:publicar', 'avisos:comentar', 'comentarios:moderar',
  'eventos:ler', 'eventos:criar', 'eventos:editar', 'eventos:inscrever',
  'eventos:participantes', 'eventos:checkin', 'eventos:exportar',
  'galeria:ler', 'galeria:enviar',
  'documentos:ler', 'documentos:gerir',
  'dashboard:ler', 'contato:responder');

-- Membro: leitura e participação. Edição do próprio perfil e inscrições próprias
-- são checadas no registro (o dono do dado), não por permissão.
INSERT INTO perfil_permissoes (perfil_id, permissao_id)
SELECT (SELECT id FROM perfis WHERE codigo = 'membro'), id FROM permissoes
WHERE recurso || ':' || acao IN (
  'avisos:ler', 'avisos:comentar', 'eventos:ler', 'eventos:inscrever',
  'galeria:ler', 'documentos:ler');

-- Visitante: sem permissões; só as rotas /public/* do site.

COMMIT;
