import type { Context } from '@netlify/functions';

/**
 * Acesso simplificado exclusivo ao preview de testes da V09.
 * Protegido externamente pela senha geral de Visitor access do projeto Netlify.
 * Nunca libera APIs para a URL de produção.
 */
export function isV09PasswordOnlyPreview(request: Request, context: Context): boolean {
  const host = new URL(request.url).hostname;
  return context.deploy.context === 'deploy-preview'
    && context.site.name === 'fgpoststudio'
    && /^(?:deploy-preview-\d+|[a-f0-9]{24})--fgpoststudio\.netlify\.app$/.test(host);
}
