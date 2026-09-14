# FG Post Studio

Este arquivo é a fonte de contexto do projeto para futuras alterações. Antes de modificar a aplicação, consulte este documento e preserve as funcionalidades existentes, evitando substituir arquivos inteiros por versões antigas.

## 1. Visão geral

O FG Post Studio é uma plataforma de criação de conteúdos para o Favela Gaming. O objetivo é centralizar templates oficiais, edição de textos, imagens e vídeos, montagem de posts e carrosséis e exportações prontas para social media diretamente no navegador.

Descrição curta de apresentação:

> O FG Post Studio é uma plataforma de criação de conteúdos para o Favela Gaming, reunindo templates, edição de textos, imagens e vídeos em um só lugar. Permite montar posts e carrosséis com ajustes visuais padronizados e exportar em PNG, GIF, MP4 ou ZIP de forma rápida e prática.

## 2. Repositório e deploy

- GitHub: `almirneto-bit/fgstudioopenpost`
- Branch principal: `main`
- Deploy principal: Vercel
- Projeto Vercel: `fgstudioopenpost`
- Workspace Vercel usado anteriormente: `almirneto-6134s-projects`
- O projeto também possui workflow de GitHub Pages, mas a etapa `Configure GitHub Pages` pode falhar caso Pages não esteja habilitado em Settings. Isso não significa falha no build da aplicação.
- O Vercel já foi validado com deploy de sucesso após a integração das funcionalidades mais recentes.

## 3. Estado atual da plataforma

A aplicação deve preservar todas as funcionalidades abaixo.

### Criações e carrosséis

- Criar projetos de social media.
- Trabalhar com múltiplas lâminas no mesmo projeto.
- Adicionar novas lâminas.
- Selecionar a lâmina ativa.
- Duplicar lâminas.
- Excluir lâminas.
- Reordenar lâminas.
- Nomear a criação.
- Exportar uma lâmina individual.
- Exportar o carrossel completo em ZIP.

### Histórico local

- Salvar automaticamente as criações no navegador.
- Manter as 5 criações mais recentes.
- Reabrir criações anteriores.
- Armazenamento local via IndexedDB.
- Não depende de nuvem para o histórico.

### Mídia

- Aceitar imagem ou vídeo em uma lâmina.
- Imagens continuam funcionando como antes.
- Vídeos devem tocar em loop na prévia.
- Controles compartilhados para imagem e vídeo:
  - Zoom.
  - Posição horizontal.
  - Posição vertical.
- Ao trocar a mídia, os ajustes de enquadramento devem ser reiniciados quando necessário.

### Exportação

- PNG em `1080 x 1440`.
- GIF para lâminas com vídeo.
- MP4 para lâminas com vídeo.
- MP4 atualmente sem áudio.
- GIF pensado para reduzir peso, usando resolução e frame rate menores que o MP4 quando necessário.
- Exportação deve ser feita no navegador sempre que possível.
- Evitar depender de FFmpeg nativo em servidor/Vercel.
- ZIP do carrossel contém PNGs das lâminas.
- Quando uma lâmina usa vídeo e entra no ZIP, usar um frame estático para o PNG.

### Textos

- Tag.
- Headline.
- Body.
- Quebras de linha manuais devem ser preservadas.
- Tamanho da headline ajustável.
- Tamanho do body ajustável.
- Ajuste automático de texto para evitar estouro quando aplicável.
- Controles de espaçamento entre blocos de texto.
- CAPSLOCK independente por campo:
  - Tag ou Handle.
  - Headline.
  - Body.
- O CAPSLOCK altera a renderização/exportação sem destruir o texto digitado original.

### Logo Favela Gaming

A logo principal do Favela Gaming pode assumir apenas estas três cores:

- Branco.
- Preto.
- Laranja.

A troca de cor deve funcionar tanto na prévia quanto no arquivo exportado.

A logo secundária não deve ser alterada por esse seletor.

### Ajustes visuais

- Sombra inferior independente.
- Sombra superior independente.
- Overlay de cor sobre a mídia.
- Controle de cor do overlay.
- Controle de opacidade do overlay.
- Overlay com padrão inicial de aproximadamente 5% quando ativo por padrão no layout correspondente.
- Noise opcional.
- Controle de intensidade do noise.
- Controle de tamanho do grão.
- Noise deve aparecer também no arquivo final exportado.
- Margem de segurança de 88 px.
- A margem de segurança aparece apenas na prévia e nunca no arquivo exportado.

## 4. Layouts e Figma

Arquivo Figma de referência:

`https://www.figma.com/design/nFGyMzuoPY9juC20nkPvhF/Welcome-World`

Page principal de referência:

`Test_SM-Post`

O editor possui uma biblioteca de layouts baseada nessa page.

### Layouts já existentes antes dos modelos 7 a 9

- Clássico com tag.
- Kanit à esquerda.
- Kanit à direita.
- Kanit central.
- Vina à esquerda.
- Vina à direita.

Frames usados anteriormente:

- `271:2`
- `277:3`
- `277:52`
- `277:84`
- `277:116`
- `277:155`

### Modelos adicionados posteriormente

Page `Test_SM-Post`, node inicial informado:

`https://www.figma.com/design/nFGyMzuoPY9juC20nkPvhF/Welcome-World?node-id=285-12&m=dev`

Foram adicionados os modelos:

- Instagram post 7.
- Instagram post 8.
- Instagram post 9.

Referências identificadas:

- Post 7: node `285:12`.
- Post 8: node `285:50`.
- Post 9: node `285:140`.

Características gerais desses modelos:

### Post 7

- Fundo laranja.
- Headline grande no topo.
- Mídia na parte inferior.
- Cantos superiores da área de mídia arredondados.
- Logos posicionadas na base.

### Post 8

- Fundo laranja.
- Mídia na parte superior.
- Cantos inferiores da área de mídia arredondados.
- Headline grande na área inferior.
- Logos posicionadas no topo.

### Post 9

- Faixa laranja superior.
- Handle no topo.
- Card claro com copy em destaque.
- Uso de Kanit.
- Mídia abaixo da área de texto.
- Logos na base.

## 5. Fontes

Fontes usadas no sistema visual:

- Inter para a interface.
- Vina Sans para layouts específicos.
- Kanit para layouts específicos e o Post 9.
- Noto Sans para textos auxiliares e layouts existentes.

A aplicação usa Google Fonts atualmente, portanto o carregamento das fontes depende de acesso à rede.

## 6. Arquitetura atual

Estrutura principal:

- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `components/post/SmPostEditor.tsx`
- `components/post/SmPostCanvas.tsx`
- `lib/smPostTemplate.ts`
- `lib/smPostStorage.ts`
- `public/post/logo-fg.svg`
- `public/post/logo-secondary.svg`
- `styles/tokens.css`

Bibliotecas relevantes:

- Next.js.
- React.
- JSZip.
- `gifenc` para GIF.
- `mp4-muxer` para MP4.
- WebCodecs para codificação do MP4 no navegador quando suportado.

## 7. Regras importantes de implementação

1. Nunca substituir a arquitetura atual por uma base antiga ao adicionar um novo modelo.
2. Novos layouts devem ser adicionados à biblioteca existente de layouts.
3. Preservar carrossel, histórico, exportação ZIP, controles avançados, logo por cor, vídeo, GIF/MP4 e CAPSLOCK em qualquer novo modelo.
4. Toda nova mídia deve continuar compatível com zoom e posição.
5. Qualquer alteração visual deve refletir tanto na prévia quanto no arquivo exportado.
6. Margens de segurança são apenas de preview.
7. Evitar dependência de backend para funções que já podem rodar no navegador.
8. Antes de enviar para `main`, validar pelo menos o build do Next.js.
9. Não interpretar falha da etapa `Configure GitHub Pages` como falha da aplicação se `Build static site` tiver passado.
10. Quando houver risco de sobrescrever uma versão estável, criar branch de segurança antes.

## 8. Histórico importante

Houve um incidente em que a implementação dos Posts 7 a 9 foi aplicada sobre uma base anterior e removeu ajustes feitos na manhã do mesmo dia.

Os ajustes da manhã estavam preservados na branch:

`feat/carousel-layouts-history-overlays`

Commit importante dessa versão:

`8d118a1f485249ebd1e3b164695ea064a8a515d7`

Essa versão continha:

- Sistema de carrossel.
- 6 layouts.
- Histórico local.
- Sombras separadas.
- Overlay de cor.
- Noise.
- Safe area.
- Exportação de lâmina e ZIP.

A `main` foi restaurada preservando esse estado no commit:

`66557b50f4ca3f0ddf2631249cadc98ca3ad2a9e`

Foi criada uma branch de segurança:

`backup/main-before-morning-restore`

Depois disso, as funcionalidades mais recentes foram integradas corretamente por cima da arquitetura restaurada.

Commit da integração completa:

`11507150b6824dc4c6a85d3910f25a3ee599eb90`

Mensagem:

`feat: integrate logo colors video exports caps and posts 7-9`

Esse commit integrou:

- Cor da logo.
- Vídeo.
- GIF.
- MP4.
- CAPSLOCK.
- Posts 7, 8 e 9.
- Preservação do sistema de carrossel e histórico.

O build estático passou nessa integração, e o Vercel reportou deploy concluído com sucesso.

## 9. Referência de exportação em vídeo

Projeto usado como referência para a implementação de vídeo:

`https://github.com/appariciojunior/motion-studio-open`

Princípios aproveitados:

- Exportação MP4 client-side.
- WebCodecs.
- `mp4-muxer`.
- GIF client-side com `gifenc`.
- Evitar FFmpeg nativo em ambiente serverless quando não for necessário.

## 10. Direção do produto

O FG Post Studio deve evoluir como um mini editor de social media focado no sistema visual do Favela Gaming, priorizando:

- Consistência de marca.
- Facilidade para profissionais de social media.
- Redução de erros de aplicação visual.
- Templates oficiais prontos para edição.
- Fluxo rápido de imagem e vídeo.
- Exportações simples e previsíveis.
- Interface clean e funcional.

## 11. Checklist para futuras alterações

Antes de finalizar qualquer nova feature, confirmar:

- O carrossel continua funcionando?
- Histórico local continua funcionando?
- Os layouts antigos continuam disponíveis?
- Posts 7, 8 e 9 continuam disponíveis?
- Imagem continua funcionando?
- Vídeo continua funcionando?
- Zoom e posicionamento continuam funcionando?
- Logo branco/preto/laranja continua funcionando?
- CAPSLOCK continua funcionando?
- Overlay continua funcionando?
- Sombras continuam funcionando?
- Noise continua funcionando?
- Safe area continua preview-only?
- PNG funciona?
- GIF funciona em vídeo?
- MP4 funciona em vídeo?
- ZIP do carrossel funciona?
- O build do Next.js passa?

Se alguma mudança exigir remover ou alterar uma dessas capacidades, isso deve ser tratado explicitamente antes de modificar a `main`.
