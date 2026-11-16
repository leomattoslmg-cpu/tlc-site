-- Tesoureiro(a) também publica e edita avisos.
INSERT INTO perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, pm.id FROM perfis p, permissoes pm
WHERE p.codigo = 'tesoureiro' AND pm.recurso || ':' || pm.acao = 'avisos:publicar'
ON CONFLICT DO NOTHING;
