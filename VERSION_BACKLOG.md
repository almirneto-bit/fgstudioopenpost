# FG Post Studio — Version Backlog

Este arquivo registra as mudanças funcionais consolidadas do FG Post Studio. O histórico detalhado de cada arquivo continua preservado pelo Git; este documento funciona como um índice humano das versões e decisões principais.

## Regra para próximas alterações

Sempre que uma mudança funcional for enviada para a `main`:

1. criar uma branch de segurança quando houver risco de regressão;
2. manter as funcionalidades existentes descritas em `PROJECT_CONTEXT.md`;
3. registrar aqui a data, o objetivo, os principais ajustes e o commit funcional;
4. validar o build automático antes de considerar a versão estável.

## v05 — 25/09/2026

Commit funcional: `8a316267759ccd55a30455e4c899034a4c5aad35`

Branch de segurança: `backup/main-before-v05-2026-09-25`

### Ajustes

- Adicionada opção **Manter áudio no MP4** para vídeos.
- O áudio original é combinado com o vídeo renderizado quando o navegador oferece captura compatível.
- Quando o áudio é solicitado mas não pode ser capturado, a exportação informa o problema em vez de concluir silenciosamente.
- Removido o limite de 240 caracteres da headline.
- Removido o limite de 520 caracteres do body.
- Removidos os limites máximos de tamanho da headline e do body.
- Headline e body passam a respeitar diretamente o tamanho digitado pelo usuário.
- Posts 7, 8 e 9 ganharam controle de cor-base.
- Presets adicionados: laranja, vermelho, ciano, amarelo e preto.
- Adicionada opção de cor personalizada.
- Textos de destaque dos layouts especiais ajustam contraste automaticamente em fundos claros/escuros.
- Identificação visual do editor atualizada para v05.

### Arquivos principais alterados

- `components/post/SmPostEditor.tsx`
- `components/post/SmPostCanvas.tsx`
- `lib/smPostTemplate.ts`

## v04 — 14/09/2026

Commit de integração: `11507150b6824dc4c6a85d3910f25a3ee599eb90`

### Ajustes principais

- Cor da logo Favela Gaming.
- Suporte a vídeo.
- Exportação GIF.
- Exportação MP4.
- CAPSLOCK independente por campo.
- Posts 7, 8 e 9.
- Preservação do carrossel, histórico local e controles avançados.

## Restauração da base estável — 14/09/2026

Commit: `66557b50f4ca3f0ddf2631249cadc98ca3ad2a9e`

### Contexto

A `main` foi restaurada após uma integração substituir parte dos ajustes existentes. A restauração preservou carrossel, layouts, histórico local, sombras, overlay, noise, safe area e exportação.

Branch histórica importante: `feat/carousel-layouts-history-overlays`

Commit de referência: `8d118a1f485249ebd1e3b164695ea064a8a515d7`

## Contexto consolidado — 14/09/2026

Commit: `fd75e2a3a79816fa0baa2177d6cafe55176a9173`

Foi criado o `PROJECT_CONTEXT.md` como fonte oficial de contexto e checklist anti-regressão do projeto.
