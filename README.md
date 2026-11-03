# FG Post Studio — V09 (beta)

Plataforma interna de criação de posts e carrosséis do Favela Gaming, produto Final Level Co.

## Acesso de demonstração

**Deploy Preview:** https://deploy-preview-3--fgpoststudio.netlify.app

O site solicita a senha geral configurada no Netlify. Depois, a home oferece dois ambientes:

- **Criar posts** (`/criar`): nove layouts tradicionais e templates PSD publicados; edição, carrosséis, PNG, GIF, MP4 e ZIP no motor existente.
- **Administração** (`/admin`): visão geral de uso no preview, lista de criações e exportação CSV, biblioteca de templates e revisão de versões, importação PSD, biblioteca de recursos e diagnóstico de infraestrutura.

O Netlify Identity está preparado para perfis separados, mas **desligado no preview por decisão de produto**. O acesso por senha geral libera ambos os painéis.

**Atenção:**
- As atividades do dashboard são reais **apenas para este deploy de teste**, e não incluem o histórico antigo do Supabase.
- A importação de PSD usa `ag-psd` e pode apresentar diferenças visuais em fontes, filtros, efeitos, máscaras e smart objects. O PSD original não é enviado ao servidor. O resultado editável é uma composição rasterizada para PNG, não um PSD regravado.
- Templates importados e metadados administrativos do preview são temporários e isolados por deploy no Netlify Blobs.
- Rascunhos do editor de posts ficam somente neste navegador (IndexedDB, até cinco recentes).
- O Supabase e o histórico original ainda **não foram migrados**. Não confundir o modo de preview com persistência multiusuário concluída.

## Código e documentação

- Branch: `feat/v09-netlify-admin-creator`; pull request #3 em rascunho.
- Código de administração: `app/admin/` e `netlify/functions/`.
- Engine original: `components/post/`, `lib/smPostTemplate.ts`, `lib/smPostStorage.ts`.
- Identidade Final Level (inclui 442 ícones): `branding/final-level/`.
- Referência técnica: `PROJECT_CONTEXT.md`.
- Histórico cumulativo: `CHANGELOG.md`.
- Plano de migração e critérios de aceite: `V09_MIGRATION.md`.

Requer Node.js 22.16+; a homologação usa GitHub Actions com `npm ci`, `npm run typecheck` e `npm run build`. Não publicar em `main` antes da migração e regressão.

---

## README anterior (legado)

# FG Post Studio v03

Editor de posts e carrosséis na home (`/`). Somente o editor está incluído; não há engine de vídeo, catálogo, Timeline, 3D, Mockup, Web, Board ou docs.

## Recursos

- Seis layouts reproduzidos da page `Test_SM-Post` do Figma.
- Menu lateral para adicionar, selecionar, reordenar, duplicar e excluir lâminas.
- Histórico local automático com as cinco criações mais recentes, sem sincronização em nuvem.
- Sombras superior e inferior independentes.
- Camada de cor configurável sobre a imagem, ativa em 5% por padrão.
- Controles de imagem, texto, espaçamento, noise e margem de segurança.
- Exportação da lâmina atual em PNG ou do carrossel completo em ZIP.

## Executar

Requer Node.js 20.9 ou superior.

`npm ci`
`npm run dev`

## Validar e compilar

`npm run typecheck`
`npm run build`
`npm start`

PNG 1080 × 1440, com os logos originais do Figma incluídos em `public/post`. A exportação aguarda fontes e imagens e desenha uma composição completa independente da prévia. Fontes Google requerem conexão. Headline, tag e body preservam a capitalização e as quebras de linha digitadas.

Referência: somente `Test_SM-Post`, frames `271:2`, `277:3`, `277:52`, `277:84`, `277:116` e `277:155`. Tokens de interface preservados do projeto Motion Studio. Licença e NOTICE originais mantidos.

Para hospedagem estática, defina STATIC_EXPORT=1; se houver subpasta, defina PAGES_BASE_PATH antes do build.
