-- FG Post Studio V09: schema inicial do Netlify Database.
-- Sem exclusão de dados. A importação do Supabase será separada e idempotente.
-- ACL aplicada apenas em funções autenticadas; NÃO abrir acesso direto ao banco ao browser.

CREATE TABLE IF NOT EXISTS fg_projects (
  id text PRIMARY KEY,
  owner_id text,
  name text NOT NULL,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_slide_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  imported_from text,
  CHECK (jsonb_typeof(slides) = 'array')
);
CREATE INDEX IF NOT EXISTS fg_projects_owner_updated_idx ON fg_projects (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS fg_templates (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Outros',
  description text NOT NULL DEFAULT '',
  template_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fg_templates_browse_idx ON fg_templates (is_published, category, sort_order);

CREATE TABLE IF NOT EXISTS fg_template_versions (
  id bigserial PRIMARY KEY,
  template_id text NOT NULL REFERENCES fg_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, version)
);

CREATE TABLE IF NOT EXISTS fg_audit_log (
  id bigserial PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
