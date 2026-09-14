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
