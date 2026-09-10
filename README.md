# FG Post Studio — v02

Editor de post na home (/). Somente o editor está incluído; não há engine de vídeo, catálogo, Timeline, 3D, Mockup, Web, Board ou docs.

## Executar

Requer Node.js 20.9 ou superior.

`npm ci`
`npm run dev`

## Validar e compilar

`npm run typecheck`
`npm run build`
`npm start`

PNG 1080 × 1440, com os logos originais do Figma incluídos em public/post. Exportação aguarda fontes e imagens e desenha uma composição completa independente da prévia. Fontes Google requerem conexão. A headline e a tag preservam a capitalização digitada; a aparência dos glifos segue Vina Sans. A sombra escurece a base. CSS exclusivo sm-post evita colisões.

Referência: somente Test_SM-Post, frame 271:2. Tokens de interface preservados do projeto Motion Studio. Licença e NOTICE originais mantidos.

Para hospedagem estática, defina STATIC_EXPORT=1; se houver subpasta, defina PAGES_BASE_PATH antes do build.
