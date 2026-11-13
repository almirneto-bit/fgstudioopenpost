-- Base editorial: os nove layouts históricos continuam renderizados pelo motor existente.
-- Esta tabela altera apenas metadados de catálogo até a engine de templates V09 estar pronta.
INSERT INTO fg_templates (id, slug, title, category, template_definition, is_published, sort_order) VALUES
 ('classic', 'classic', 'Clássico com tag', 'Título e imagem', '{"layoutId":"classic"}'::jsonb, true, 10),
 ('kanit-left', 'kanit-left', 'Texto à esquerda', 'Título e imagem', '{"layoutId":"kanit-left"}'::jsonb, true, 20),
 ('kanit-right', 'kanit-right', 'Texto à direita', 'Título e imagem', '{"layoutId":"kanit-right"}'::jsonb, true, 30),
 ('vina-left', 'vina-left', 'Título à esquerda', 'Título e imagem', '{"layoutId":"vina-left"}'::jsonb, true, 40),
 ('vina-right', 'vina-right', 'Título à direita', 'Título e imagem', '{"layoutId":"vina-right"}'::jsonb, true, 50),
 ('kanit-center', 'kanit-center', 'Texto centralizado', 'Destaque central', '{"layoutId":"kanit-center"}'::jsonb, true, 60),
 ('post-7', 'post-7', 'Imagem na base', 'Destaque central', '{"layoutId":"post-7"}'::jsonb, true, 70),
 ('post-8', 'post-8', 'Imagem no topo', 'Destaque central', '{"layoutId":"post-8"}'::jsonb, true, 80),
 ('post-9', 'post-9', 'Comunicado em card', 'Comunicados', '{"layoutId":"post-9"}'::jsonb, true, 90)
ON CONFLICT (id) DO NOTHING;
