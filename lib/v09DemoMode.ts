/**
 * Modo temporario de teste.
 * Habilitado SOMENTE em builds de deploy-preview via netlify.toml.
 * Nao habilitar em producao: ausencia do valor mantem login + RBAC do Identity.
 */
export const V09_DEMO_MODE = process.env.NEXT_PUBLIC_FG_V09_DEMO === '1';
