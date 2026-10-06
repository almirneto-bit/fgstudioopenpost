# FG Post Studio — Version Backlog

Este arquivo registra as mudanças funcionais consolidadas do FG Post Studio. O histórico detalhado de cada arquivo continua preservado pelo Git; este documento funciona como um índice humano das versões e decisões principais.

## Regra para próximas alterações

Sempre que uma mudança funcional for enviada para a `main`:

1. criar uma branch de segurança quando houver risco de regressão;
2. manter as funcionalidades existentes descritas em `PROJECT_CONTEXT.md`;
3. registrar aqui a data, o objetivo, os principais ajustes e o commit funcional;
4. validar o build automático antes de considerar a versão estável.

## v07.1 — 06/10/2026

Commit funcional principal: `b4546669e023e1912abd6bbcbb756c920001d85c`

Ajuste visual: `1f98543dc4545f444d1142925c2e6252bd75c0da`

Branch de segurança: `backup/main-before-v071-manual-cloud-save-2026-10-06`

### Ajustes

- Supabase deixa de receber autosave automático durante a edição.
- IndexedDB continua salvando automaticamente como rascunho local.
- Adicionado botão com ícone **Salvar no histórico** abaixo do nome da criação.
- Primeiro salvamento cria a entrada em `fg_projects`.
- Novos cliques atualizam a mesma criação usando o mesmo ID.
- Adicionados estados visuais: rascunho local, salvando, salvo, alterações não salvas e erro.
- Alterações posteriores a um projeto já salvo passam a indicar **Salvar alterações**.
- A lista lateral **Histórico** passa a exibir somente projetos existentes no Supabase.
- Histórico mostra quantidade de lâminas e data/hora da última edição salva.
- Criar uma nova criação não envia automaticamente a criação anterior ao Supabase.
- Ao abrir uma criação do histórico, ela também é armazenada localmente para continuidade e fallback.
- Interface identificada como v07.1.

### Fluxo de persistência

- Edição contínua → IndexedDB.
- Clique em **Salvar no histórico** → Supabase `fg_projects`.
- Histórico lateral → exclusivamente Supabase.
- Falha no Supabase não impede o autosave local.

## v07 — 05/10/2026

Commit funcional principal: `60bdbe33a2b154aedb6a1dcd1b78c6d087985b90`

Branch de segurança: `backup/main-before-v07-supabase-history-2026-10-05`

### Ajustes

- Adicionada integração do histórico de projetos com Supabase.
- Criado client browser em `lib/supabase/client.ts`.
- Criada camada de persistência em nuvem em `lib/smPostCloudStorage.ts`.
- Histórico passa a priorizar o Supabase e usar IndexedDB como fallback local.
- Autosave grava na nuvem quando disponível e preserva salvamento local.
- Abertura de projetos tenta buscar no Supabase e recorre ao IndexedDB em caso de falha.
- Histórico online deixa de depender do limite local de cinco projetos.
- Variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configuradas no Vercel.
- Upload de mídia permanece no modelo atual nesta fase; migração para Supabase Storage fica para uma etapa posterior.
- Interface identificada como v07.

### Pré-requisito no Supabase

A tabela `public.fg_projects` precisa existir com RLS/policies compatíveis com a estratégia atual de histórico compartilhado.

### Arquivos principais alterados

- `package.json`
- `lib/supabase/client.ts`
- `lib/smPostCloudStorage.ts`
- `components/post/SmPostEditor.tsx`

## v06 — 25/09/2026

Commit principal: `0c1dc466360b47495d5d56a7ed4522043fac016e`

Ajuste complementar: `46e136510da6efc69894fb4f7300be45c52cfeed`

Branch de segurança: `backup/main-before-v06-2026-09-25`

### Ajustes

- Headline e body agora possuem uma área compacta de **Edições**.
- CAPSLOCK, tamanho e entrelinha ficam agrupados dentro dessa área.
- Tamanho de fonte voltou a ser controlado por slider.
- Limite dos sliders definido entre 8 e 250 px.
- Adicionado controle de entrelinha independente, de 0.5× a 2.0×.
- Mantido o texto sem limite de caracteres.
- Vídeos ganharam uma timeline simplificada abaixo do preview.
- Adicionados play/pause, scrub de tempo e indicação de tempo atual/duração.
- Adicionado recorte de início e fim do vídeo.
- Preview pausa ao chegar no final do recorte.
- GIF exporta somente o trecho selecionado.
- MP4 exporta somente o trecho selecionado.
- Quando **Manter áudio no MP4** está ativo, o recorte usa a mesma janela temporal para vídeo e áudio.
- PNG estático de vídeo usado no ZIP passa a utilizar o primeiro frame do recorte.
- Interface identificada como v06.

### Arquivos principais alterados

- `components/post/SmPostEditor.tsx`
- `components/post/SmPostCanvas.tsx`
- `lib/smPostTemplate.ts`
- `app/globals.css`

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


## v08-alpha — Auto Layout com Kie.ai (2026-10-06)

- Adicionado botão **Auto Layout** no painel de edição.
- A IA analisa o estado estruturado da lâmina e, quando disponível, uma captura visual reduzida do canvas.
- Integração preparada para Kie.ai usando Gemini 3.8 Flash pela função segura `/api/auto-layout`.
- A chave `KIE_API_KEY` fica somente no servidor/Vercel e nunca é enviada ao navegador.
- Nesta primeira versão, a IA pode sugerir apenas propriedades já suportadas pelo editor:
  - tamanho e entrelinha de headline;
  - tamanho e entrelinha de body;
  - espaçamentos verticais entre blocos;
  - zoom e posição da mídia.
- Sugestões passam por validação e limites antes de chegar ao canvas.
- Alterações entram primeiro em modo de prévia com **Aplicar** ou **Descartar**.
- A prévia não altera o projeto nem dispara salvamento no histórico até o usuário confirmar.
- Branch de segurança: `backup/main-before-auto-layout-v01-2026-10-06`.


## v08-beta — Auto Layout orientado por design + UX de edição (2026-10-06)

- Auto Layout agora possui três modos de intenção:
  - Equilibrado;
  - Legibilidade;
  - Headline forte.
- Regras de composição passaram a considerar proximidade, alinhamento, hierarquia, safe area e espaço negativo.
- Headline + body são tratados semanticamente como um único grupo visual nos templates standard.
- Guardrails determinísticos:
  - body mínimo de 26px;
  - no modo Legibilidade, body mínimo de 30px;
  - entrelinha mínima mais confortável;
  - limite ampliado para aproximar headline e body sem quebrar o template.
- O backend Kie passa a receber o modo escolhido e instruções específicas de direção de layout.
- Posição horizontal e vertical da mídia migraram de inputs numéricos para sliders.
- Adicionado botão “Centralizar mídia”.
- Edição direta de texto no canvas:
  - duplo clique em headline, body, tag/handle;
  - edição acontece sobre a arte;
  - Esc ou clique fora encerra a edição;
  - painel lateral continua sincronizado e disponível.
- A prévia do Auto Layout também aplica guardrails de legibilidade mesmo quando a IA não propõe mudanças suficientes.
- UI identificada como `v08-beta`.


## v08-beta.1 — TextGroup real + perfis por template (2026-10-06)

- Criado um grupo de texto real com offsets próprios:
  - `textGroupOffsetX`;
  - `textGroupOffsetY`.
- Headline e body agora podem ser reposicionados juntos sem perder a relação interna.
- Adicionados controles de largura:
  - `headlineWidth`;
  - `bodyWidth`.
- Mudanças de largura preservam o eixo original do template:
  - esquerda mantém borda esquerda;
  - centro mantém centro;
  - direita mantém borda direita.
- Adicionados perfis específicos para cada template com:
  - faixa horizontal/vertical segura do grupo;
  - largura recomendada de headline;
  - largura recomendada de body;
  - body mínimo;
  - faixa preferencial de proximidade headline/body.
- Auto Layout passa a receber e controlar os novos parâmetros.
- Guardrails clampam sugestões da IA aos limites de cada template.
- Layout Post 9 também passou a respeitar grupo de texto e largura de body.
- Projetos antigos continuam compatíveis via normalização automática.
- UI identificada como `v08-beta.1`.


## v08-beta.2 — Simplificação do Auto Layout e edição direta no canvas (2026-10-06)

- Removidos os controles de grupo/largura de texto adicionados na beta.1.
- Auto Layout passa a operar somente no modo Legibilidade, sem dropdown.
- Guardrails de leitura:
  - body mínimo de 30px nos layouts standard;
  - body mínimo de 32px no card especial;
  - proximidade headline/body limitada por template;
  - preservação da estrutura original dos layouts.
- Edição direta de texto refeita:
  - um clique sobre headline, body, tag ou handle entra em edição;
  - texto do canvas é temporariamente ocultado durante a edição para evitar duplicidade;
  - editor usa o mesmo posicionamento, fonte, alinhamento e entrelinha da arte;
  - clique fora ou Esc conclui a edição;
  - boxes laterais continuam disponíveis, mas não são obrigatórios.
- Noise padrão alterado para:
  - Intensidade: 30%;
  - Tamanho do grão: 01.
- Layouts reorganizados visualmente em grupos:
  - Base;
  - Kanit;
  - Vina;
  - Especiais.
- Layouts renomeados sem alterar IDs internos, preservando compatibilidade.
- UI identificada como `v08-beta.2`.
