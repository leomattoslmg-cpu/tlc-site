-- Excluir evento: só Super Administrador e coordenação (coordenador, geral e diocesano).
INSERT INTO permissoes (recurso, acao) VALUES ('eventos', 'excluir') ON CONFLICT DO NOTHING;

INSERT INTO perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, pm.id FROM perfis p, permissoes pm
WHERE p.codigo IN ('super_admin', 'coordenador', 'coordenador_geral', 'coordenador_diocesano')
  AND pm.recurso = 'eventos' AND pm.acao = 'excluir'
ON CONFLICT DO NOTHING;
