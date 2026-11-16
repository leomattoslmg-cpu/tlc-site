-- Cargos da coordenação, dados pelo Super Administrador a quantas pessoas forem necessárias.
INSERT INTO perfis (codigo, nome, nivel) VALUES
  ('coordenador_geral',      'Coordenador(a) geral',      3),
  ('coordenador_diocesano',  'Coordenador(a) diocesano',  3),
  ('tesoureiro',             'Tesoureiro(a)',             3),
  ('marketing',              'Marketing',                 3)
ON CONFLICT (codigo) DO NOTHING;

-- Coordenação geral e diocesana: tudo o que o coordenador faz + aprovar cadastros.
INSERT INTO perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, pm.id FROM perfis p, permissoes pm
WHERE p.codigo IN ('coordenador_geral', 'coordenador_diocesano')
  AND pm.recurso || ':' || pm.acao IN (
    'usuarios:aprovar', 'membros:ler',
    'avisos:ler', 'avisos:publicar', 'avisos:comentar', 'comentarios:moderar',
    'eventos:ler', 'eventos:criar', 'eventos:editar', 'eventos:inscrever',
    'eventos:participantes', 'eventos:checkin', 'eventos:exportar',
    'galeria:ler', 'galeria:enviar', 'galeria:excluir_proprio',
    'documentos:ler', 'documentos:gerir',
    'notificacoes:enviar', 'dashboard:ler', 'site:editar')
ON CONFLICT DO NOTHING;

-- Tesouraria: consulta membros, eventos e planilhas (o módulo financeiro ainda não existe).
INSERT INTO perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, pm.id FROM perfis p, permissoes pm
WHERE p.codigo = 'tesoureiro'
  AND pm.recurso || ':' || pm.acao IN (
    'membros:ler', 'avisos:ler', 'avisos:comentar',
    'eventos:ler', 'eventos:participantes', 'eventos:exportar',
    'documentos:ler', 'dashboard:ler')
ON CONFLICT DO NOTHING;

-- Marketing: avisos, galeria, notificações e textos do site.
INSERT INTO perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, pm.id FROM perfis p, permissoes pm
WHERE p.codigo = 'marketing'
  AND pm.recurso || ':' || pm.acao IN (
    'avisos:ler', 'avisos:publicar', 'avisos:comentar',
    'eventos:ler', 'galeria:ler', 'galeria:enviar', 'galeria:excluir_proprio',
    'documentos:ler', 'notificacoes:enviar', 'dashboard:ler', 'site:editar')
ON CONFLICT DO NOTHING;
