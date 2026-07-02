# Prompt para Claude Code — Setup e Deploy do Projeto "Controle de Entregas CAROLDO"

## Como usar este prompt

1. Faça download do projeto completo (zip) e descompacte localmente
2. Inicialize um repositório git: `git init && git add -A && git commit -m "init"`
3. Abra o diretório no terminal e rode `claude code` (Claude Code CLI)
4. Cole o prompt abaixo inteiro (até o fim) como primeira mensagem para o Claude Code

---

## PROMPT PARA O CLAUDE CODE (copie tudo abaixo)

```
Você está assumindo o setup e deploy de uma aplicação Next.js 16 já construída chamada "Controle de Entregas CAROLDO". O projeto está completo e funcional localmente, mas precisa ser configurado, migrado de SQLite para PostgreSQL, e deployado para que possa ser compartilhado com usuários finais para validação.

# CONTEXTO DO PROJETO

Aplicação web para controle de entregas de materiais, EPIs, uniformes e documentos a terceirizados no Contrato de Manutenção Predial 003/2026 do Estado do Rio Grande do Sul (Secretaria da Casa Civil) com a empresa CAROLDO.

Stack:
- Next.js 16 (App Router) + TypeScript 5 + React 19
- Tailwind CSS 4 + shadcn/ui (New York style)
- Prisma 6 (atualmente com SQLite, PRECISA migrar para PostgreSQL)
- Bun como gerenciador de pacotes
- Imagens dos itens e brasão do RS já estão em /public/uploads/itens/ e /public/brasao-rs.jpg

Funcionalidades já implementadas e funcionais:
- Dashboard com KPIs e pendências por posto
- CRUD de terceirizados (CPF como chave única)
- Cadastro com máscara de CPF, validação de unicidade
- Mudança de posto com histórico (preservado mesmo após desligamento)
- Desligamento/reativação sem perda de histórico
- CRUD de itens por categoria (Materiais, EPI, Uniforme, Documento) com imagem
- Checklists por colaborador mostrando itens esperados vs entregues
- Registro de entregas com anexo (apenas para categoria Documento)
- Geração de relatório HTML print-friendly com brasão do RS e campos de assinatura
- Modal de visualização de item com imagem ao clicar (em todas as views)

# O QUE PRECISO QUE VOCÊ FAÇA

## FASE 1 — Setup local e verificação

1. Verifique que Node.js 22+ e Bun 1.3+ estão instalados. Se não, instale via:
   - Node: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`
   - Bun: `curl -fsSL https://bun.sh/install | bash`

2. Rode `bun install` para instalar dependências.

3. Verifique se o arquivo `.env` existe. Se não, crie com:
   ```
   DATABASE_URL="file:./dev.db"
   ```
   (temporário para SQLite local — vamos mudar para Postgres na Fase 2)

4. Rode `bun run db:push` para criar o schema no banco local.

5. Rode `bunx tsx prisma/seed.ts` para popular o banco com:
   - Contrato 003/2026
   - Empresas CAROLDO + JIREH
   - 9 postos com cor de capacete
   - 4 categorias
   - 264 itens (com relações N:N para postos)
   - 10 colaboradores identificados

6. Rode `bun run dev` e verifique que a aplicação sobe em http://localhost:3000 sem erros. Abra no navegador, navegue entre as abas (Dashboard, Terceirizados, Itens, Checklists, Entregas) e confirme que tudo funciona.

7. Rode `bun run lint` e corrija qualquer erro reportado.

## FASE 2 — Migração de SQLite para PostgreSQL

O SQLite não persiste em deploy serverless (Vercel, Netlify). Precisamos migrar para PostgreSQL.

1. Modifique `prisma/schema.prisma`:
   - Troque `provider = "sqlite"` por `provider = "postgresql"`
   - Verifique se algum campo usa tipo específico de SQLite (nenhum deveria — todos são String/Int/Boolean/DateTime)

2. Crie uma conta gratuita em um destes serviços (recomendo Neon por ter free tier generoso e ser serverless-friendly):
   - **Neon** (https://neon.tech) — RECOMENDADO, free tier 0.5GB
   - Supabase (https://supabase.com) — free tier 500MB
   - Railway (https://railway.app) — free tier limitado

3. Crie um banco PostgreSQL e copie a connection string (formato: `postgresql://user:password@host/dbname?sslmode=require`).

4. Atualize o arquivo `.env`:
   ```
   DATABASE_URL="postgresql://...sua-connection-string..."
   ```

5. Rode `bun run db:push` para criar o schema no PostgreSQL.

6. Rode `bunx tsx prisma/seed.ts` para popular o banco PostgreSQL.

7. Teste novamente `bun run dev` e confirme que tudo funciona com Postgres.

## FASE 3 — Migração de uploads para storage externo

Atualmente as imagens são salvas em `/public/uploads/` (sistema de arquivos local). Em deploy serverless, `/public` é read-only depois do build, então uploads novos não funcionariam.

1. As imagens EXISTENTES (em `/public/uploads/itens/` e `/public/brasao-rs.jpg`) continuam funcionando porque são commitadas no repositório e servidas estaticamente.

2. Para uploads NOVOS (anexos de documentos, imagens novas de itens), migre para um storage externo. Opções recomendadas (escolha UMA):

   **Opção A — Vercel Blob (mais simples, recomendado):**
   - Instale: `bun add @vercel/blob`
   - Crie o token em https://vercel.com/dashboard/stores (ou durante o deploy)
   - Adicione `BLOB_READ_WRITE_TOKEN` ao .env
   - Modifique os helpers `saveImage` em `src/app/api/itens/route.ts` e `src/app/api/itens/[id]/route.ts` e `src/app/api/entregas/route.ts` para usar `put()` do `@vercel/blob` em vez de `fs.writeFile`
   - Os arquivos salvos retornam uma URL pública (em vez de `/uploads/itens/...`) que fica armazenada em `imagemUrl`/`anexoUrl` no banco

   **Opção B — Cloudinary (free tier 25GB):**
   - Instale: `bun add cloudinary`
   - Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` no .env
   - Mesma lógica de migração dos helpers

   **Opção C — Manter em /public/uploads com VPS própria (Railway/Fly.io):**
   - Se preferir não usar storage externo, faça deploy em Railway ou Fly.io (containers persistentes)
   - Não precisa migrar o código, mas perde escalabilidade

3. IMPORTANTE: o brasão do RS em `/public/brasao-rs.jpg` NÃO precisa migrar — é estático.

4. Após migrar, teste criando um novo item com imagem e registrando uma entrega com anexo de documento — confirme que o arquivo aparece acessível.

## FASE 4 — Deploy na Vercel

1. Crie conta em https://vercel.com (pode ser com login GitHub/GitLab/Bitbucket).

2. Faça push do projeto para um repositório Git (GitHub recomendado):
   ```bash
   git init
   git add -A
   git commit -m "Controle de Entregas CAROLDO - MVP pronto para deploy"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
   git push -u origin main
   ```

3. No painel da Vercel, clique em "Add New Project" e importe o repositório.

4. Configure o projeto:
   - Framework Preset: Next.js (auto-detectado)
   - Build Command: `bun run build`
   - Output Directory: `.next` (padrão)
   - Install Command: `bun install`
   - Node.js Version: 22.x

5. Em "Environment Variables", adicione:
   - `DATABASE_URL` = sua connection string do PostgreSQL (Neon/Supabase)
   - `BLOB_READ_WRITE_TOKEN` = seu token do Vercel Blob (se usou Opção A)
   - `CLOUDINARY_*` = suas credenciais (se usou Opção B)

6. Clique em "Deploy". Aguarde o build (cerca de 2-3 minutos).

7. Após o deploy, a Vercel vai dar uma URL como `https://seu-projeto.vercel.app`. Teste abrindo no navegador.

8. IMPORTANTE — Banco em produção: rode o seed no banco de produção:
   - Localmente, altere o `.env` temporariamente para apontar para o DATABASE_URL de produção
   - Rode `bunx tsx prisma/seed.ts` (vai popular o banco Neon/Supabase)
   - Restaure o `.env` local depois

## FASE 5 — Validação final

1. Abra a URL de produção e valide TODAS estas funcionalidades:

   **Dashboard:**
   - KPIs aparecem (10 terceirizados, 264 itens, 9 postos)
   - Pendências por posto com barras de progresso
   - Últimas 10 entregas

   **Terceirizados:**
   - Lista mostra 10 colaboradores sem coluna "Empresa"
   - Busca por nome/CPF funciona
   - Cadastrar novo terceirizado com CPF formatado funciona
   - Clicar em um colaborador abre o detalhe com histórico completo
   - Mudança de posto funciona e registra no histórico
   - Desligar/Reativar funciona
   - Botão "Gerar relatório" abre relatório em nova aba

   **Itens:**
   - Lista mostra 264 itens com thumbnails na primeira coluna
   - Filtro por categoria funciona (Materiais/EPI/Uniforme/Documento)
   - Clicar em um item abre modal com imagem ampliada
   - Editar item com upload/troca/remoção de imagem funciona
   - Criar novo item funciona

   **Checklists:**
   - Selecionar colaborador mostra itens esperados vs entregues
   - Clicar na descrição do item abre modal com imagem
   - Botão "Entregar" abre formulário (com anexo apenas se for Documento)
   - Botão "Gerar relatório" no topo do checklist

   **Entregas:**
   - Lista mostra entregas com coluna de anexo (link clicável)
   - Registrar nova entrega funciona
   - Para itens de Documento, campo de anexo aparece (opcional)
   - Para itens de Materiais/EPI/Uniforme, campo de anexo NÃO aparece

   **Relatório:**
   - Cabeçalho com brasão do RS + texto institucional + Contrato 003/2026
   - Dados do terceirizado (nome, CPF, posto, empresa, admissão)
   - Tabelas por categoria com thumbnails
   - Campos de assinatura: Fiscalização Técnica + Representante CAROLDO
   - Botão "Imprimir / Salvar PDF" funciona (window.print)

2. Compartilhe a URL de produção com os usuários para validação.

## ARQUIVOS IMPORTANTES DO PROJETO

- `prisma/schema.prisma` — schema do banco (10 modelos: Contrato, Empresa, EmpresaContrato, Posto, Colaborador, MudancaPosto, Categoria, Item, ItemPosto, Entrega, Assinatura)
- `prisma/seed.ts` — popula o banco
- `prisma/seed-data.ts` — dados extraídos do Excel original (264 itens, 9 postos, 10 colaboradores)
- `src/app/page.tsx` — SPA principal com AppProvider e 6 views
- `src/app/layout.tsx` — layout raiz (metadata do browser)
- `src/app/api/` — 14 rotas REST
- `src/app/relatorio/[colaboradorId]/page.tsx` — página de relatório print-friendly
- `src/components/app/views/` — 6 views (dashboard, colaboradores, colaborador-detalhe, itens, checklists, entregas)
- `src/components/app/shared/` — sidebar, badges, format helpers, item-visualizacao-modal
- `src/lib/db.ts` — cliente Prisma
- `public/brasao-rs.jpg` — brasão do RS (26KB)
- `public/uploads/itens/` — 230 imagens de itens extraídas do Excel (5.5MB)
- `.env` — variáveis de ambiente

## PONTOS DE ATENÇÃO

1. **NÃO apague** `public/uploads/itens/` nem `public/brasao-rs.jpg` — são referenciados pelo banco.

2. **NÃO rode `db:reset`** em produção — vai apagar todos os dados.

3. O `.gitignore` deve incluir: `node_modules/`, `.next/`, `db/`, `*.log`, `.env*` (mas NÃO inclua `.env.example`).

4. Se encontrar erro de "Prisma Client needs to be generated", rode `bunx prisma generate`.

5. Se encontrar erro "Unknown argument skipDuplicates" no SQLite, remova `skipDuplicates` do `createMany` (não suportado em SQLite; em Postgres é suportado).

6. O projeto usa Bun mas você pode trocar para npm/pnpm se preferir — basta adaptar os comandos.

7. Após o deploy, se a página de relatório não renderizar (erro 500), verifique se `@prisma/client` está atualizado no build da Vercel — às vezes é necessário adicionar `postinstall: "prisma generate"` no package.json.

## ENTREGÁVEL FINAL

Ao concluir, me entregue:
1. URL de produção (ex: https://controle-entregas-caroldo.vercel.app)
2. Confirmação de que todas as 5 fases foram concluídas
3. Lista de qualquer ajuste que precisei fazer no código original
4. Instruções para usuários finais (como acessar, o que testar)

Comece pela FASE 1 e me reporte o progresso a cada fase concluída.
```
