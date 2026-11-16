-- Notificações no celular (Web Push): um registro por aparelho/navegador que aceitou receber avisos.
CREATE TABLE push_inscricoes (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  usuario_id    uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint      text        NOT NULL UNIQUE,
  p256dh        text        NOT NULL,
  auth          text        NOT NULL,
  user_agent    text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  ultimo_envio_em timestamptz
);
CREATE INDEX push_inscricoes_usuario_idx ON push_inscricoes (usuario_id);
