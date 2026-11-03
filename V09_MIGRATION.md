# FG Post Studio V09 — Plano de migração e validação

**Status:** Em andamento na branch `feat/v09-netlify-admin-creator`. Não substituir a produção antes da validação.

## Decisões confirmadas
- Netlify Pro (equipe Final Level Co) como plataforma principal.
- Netlify Identity para login individual por e-mail e senha.
- Dois papéis: `admin` (Admin) e `creator` (Criador).
- Netlify Database (PostgreSQL) para projetos e catálogo.
- Netlify Blobs para mídias, com solução específica de upload de vídeos grandes.
- Tema claro por padrão, conforme tokens da Final Level anexados em 03/11/2026.
- Templates Favela Gaming preservados na renderização e exportação.
- CHANGELOG.md como registro cumulativo de decisões, alterações, bugs e validações.

## Etapa 1: configuração manual do Identity
1. Abrir https://app.netlify.com/projects/fgpoststudio/identity e selecionar **Enable Identity**.
2. Em Registration preferences, definir **Invite only** (nunca Open para esta ferramenta interna).
3. Convidar as pessoas autorizadas, criando uma conta administrativa inicial.
4. Atribuir a essa conta `app_metadata.roles=["admin"]` na tela de usuários do Identity; atribuir `["creator"]` aos criadores.
5. Testar a confirmação do convite, login, logout e bloqueio de /admin com conta `creator`.
6. ATENÇÃO: o site já tem uma senha geral de perímetro. Não remover até o Identity estar validado; depois, decidir se haverá login duplo ou somente login individual.

A configuração do Identity é feita no dashboard do Netlify; não existe ação pública suportada para habilitá-lo pela API.

## Etapa 2: pacotes e build
1. Usar Node.js >= 22.13.
2. [CONCLUÍDO NA BRANCH] `package-lock.json` sincronizado pelo GitHub Actions, após instalação de todas as dependências.
3. [CONCLUÍDO EM CI] Typecheck e build aprovados na execução GitHub Actions 41640774996.
4. [DEPLOY PRONTO] Netlify Deploy Preview #3: https://deploy-preview-3--fgpoststudio.netlify.app — falta testar Identity nele (não funciona completamente com `netlify dev`).
5. Validar que as tabelas e o seed são provisionados na base isolada do Deploy Preview.

## Etapa 3: migração de dados preservando histórico
1. Exportar `public.fg_projects` do Supabase (IDs, nomes, slides, ID ativo e datas).
2. Exportar o bucket `fg-studio-media` e registrar todos os links e os tipos MIME.
3. Guardar backup integral antes de transformar os dados.
4. Importar registros para `fg_projects` no Netlify Database mantendo os IDs. Definir política de propriedade para linhas legadas com `owner_id=null`: apenas admin até associação.
5. Migrar mídias para Netlify Blobs, respeitando escopo de usuário e isolamento entre Preview e produção.
6. Reescrever `imageUrl` no JSON dos slides apenas depois de confirmar que a nova mídia abre.
7. Executar checklist amostral e contagem de registros pré e pós-migração; reabrir projetos com imagem, vídeo e carrossel.
8. Só após concluir o fluxo no Netlify, substituir as chamadas de `lib/smPostCloudStorage.ts` pela nova API e retirar credenciais Supabase do ambiente.
9. Conservar backup e manter Supabase inalterado por período de rollback.

## Etapa 4: proteção dos dados
- Nunca conectar o banco Postgres diretamente ao navegador; consultas passam pelas funções autenticadas.
- Cada mutação valida papel e dono do projeto no servidor.
- Administradores podem gerenciar templates; criadores podem somente ler os publicados.
- Validar caso direto de acesso a APIs, não apenas a navegação da interface.
- Proteger rotas de Auto Layout e custos Kie.ai contra usuários não autenticados.
- Evitar acesso a dados compartilhados do Supabase antes do corte de migração.
- Blobs `getStore` são compartilhados entre previews e produção: usar store isolada por ambiente para testes.

## Etapa 5: mídia (bloqueio conhecido)
As Functions da Netlify limitam requisições buffered a 6 MB (cerca de 4,5 MB de binário). Netlify Blobs não tem fluxo nativo de upload direto do navegador. Upload de vídeos grandes requer protocolo em partes ou outra implementação robusta com autenticação, validação e montagem; NÃO assumir que um simples POST multipart atende vídeos grandes.

## Aceite obrigatório
- [ ] Login e convite funcionam.
- [ ] /admin nega login sem permissão.
- [ ] /criar aceita criadores e administradores.
- [ ] Admin pode renomear, categorizar, reordenar e publicar templates.
- [ ] Criador só recebe templates publicados.
- [ ] Projetos não vazam entre contas.
- [ ] Histórico antigo preservado e legível.
- [ ] Upload e exportação PNG/GIF/MP4/ZIP preservados, incluindo áudio.
- [ ] Chaves privadas não expostas.
- [ ] Typecheck e build passam.
- [ ] Deploy Preview funcional, produção intacta.
- [ ] CHANGELOG atualizado com commits e resultados do teste.
