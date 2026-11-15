-- QR Code de presença por evento e QR Code (convite) para o próprio membro se cadastrar.

-- Cada evento tem um código de presença (vai no QR Code). Pode ser trocado se vazar.
ALTER TABLE eventos ADD COLUMN checkin_token text UNIQUE;
UPDATE eventos SET checkin_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 WHERE checkin_token IS NULL;

-- Rastro da presença (auditoria): de onde e com que aparelho foi marcada.
ALTER TABLE evento_checkins ADD COLUMN ip inet;
ALTER TABLE evento_checkins ADD COLUMN dispositivo text;

-- Convites de cadastro: o QR leva a uma página onde a pessoa preenche os próprios dados.
CREATE TABLE convites_cadastro (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  organizacao_id  uuid        NOT NULL REFERENCES organizacoes(id),
  token           text        NOT NULL UNIQUE,
  criado_por      uuid        NOT NULL REFERENCES usuarios(id),
  expira_em       timestamptz NOT NULL,
  max_usos        integer     CHECK (max_usos IS NULL OR max_usos > 0),   -- nulo = sem limite
  usos            integer     NOT NULL DEFAULT 0,
  revogado_em     timestamptz,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE membros ADD COLUMN convite_id uuid REFERENCES convites_cadastro(id);

CREATE INDEX evento_checkins_membro_idx ON evento_checkins (membro_id);
