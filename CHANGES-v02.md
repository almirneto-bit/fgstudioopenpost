# Versão 02

- Home dedicada ao editor de post; removidos engine, catálogo, rotas e dependências de vídeo/3D.
- Preservados tokens visuais do Motion Studio em styles/tokens.css.
- Reescritos app/layout.tsx e app/globals.css para a interface independente.
- Atualizado components/post/SmPostEditor.tsx com exportação integrada e mensagens de erro.
- Atualizado components/post/SmPostCanvas.tsx: exportação atômica após carregar imagens/fontes, prevenção de corridas na prévia, tag sem dependência de roundRect e sem transformação de caixa.
- Atualizado lib/smPostTemplate.ts: gradiente escurece a base, centro da tag corrigido e logos compatíveis com subpasta de hospedagem.
- Incluídos logos originais da página Test_SM-Post do Figma.
- Mantida Vina Sans conforme preferência do usuário, sem toUpperCase.
- Ajustados package.json, lockfile e workflow do GitHub Pages.

Verificações: build de produção e estático; Chrome com roundRect desativado; PNG 1080×1440; dois logos e tag presentes; texto misto preservado; canvas centralizado; layout móvel sem overflow horizontal; rota /3d removida; nenhum erro JavaScript no teste.
