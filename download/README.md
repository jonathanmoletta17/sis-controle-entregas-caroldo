# Controle de Entregas — CAROLDO · Contrato 003/2026

Sistema web para controle de entregas de materiais, EPIs, uniformes e documentos a terceirizados no Contrato de Manutenção Predial 003/2026 do Estado do Rio Grande do Sul (Secretaria da Casa Civil) com a empresa CAROLDO.

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5 + React 19
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **Database**: Prisma 6 + SQLite (desenvolvimento) / PostgreSQL (produção)
- **Package manager**: Bun 1.3+

## Funcionalidades

- **Dashboard** com KPIs e pendências por posto
- **Terceirizados**: cadastro por CPF (chave única), histórico completo, mudança de posto, desligamento/reativação
- **Itens**: catálogo de 264 itens (Materiais/EPI/Uniforme/Documento) com imagem ilustrativa extraída do Excel original
- **Checklists**: itens esperados vs entregues por colaborador
- **Entregas**: registro com anexo (apenas para categoria Documento)
- **Relatório**: geração de relatório HTML print-friendly com brasão do RS e campos de assinatura

## Estrutura

```
prisma/
  schema.prisma          # 10 modelos
  seed.ts                # Popula o banco
  seed-data.ts           # Dados extraídos do Excel
src/
  app/
    page.tsx             # SPA principal com 6 views
    layout.tsx           # Layout raiz
    api/                 # 14 rotas REST
    relatorio/[colaboradorId]/  # Página de relatório print-friendly
  components/
    app/
      app-context.tsx    # Estado global (view atual)
      shared/            # sidebar, badges, format, modal
      views/             # 6 views (dashboard, colaboradores, etc.)
  lib/
    db.ts                # Cliente Prisma
public/
  brasao-rs.jpg          # Brasão do RS (26KB)
  uploads/
    itens/               # 230 imagens de itens (5.5MB)
    anexos/              # Anexos de documentos
```

## Setup local

```bash
# Instalar dependências
bun install

# Criar banco SQLite
bun run db:push

# Popular banco (contrato, postos, itens, colaboradores)
bunx tsx prisma/seed.ts

# Rodar em desenvolvimento
bun run dev
```

Acesse http://localhost:3000

## Deploy

Veja `PROMPT_CLAUDE_CODE_DEPLOY.md` para instruções completas de deploy na Vercel com migração para PostgreSQL.

## Modelo de dados

10 entidades:
- **Contrato** (003/2026)
- **Empresa** (CAROLDO, JIREH)
- **EmpresaContrato** (N:N)
- **Posto** (9 postos com cor de capacete)
- **Colaborador** (CPF único, histórico preservado)
- **MudancaPosto** (histórico de mudanças)
- **Categoria** (Materiais, EPI, Uniforme, Documento)
- **Item** (264 itens com imagem)
- **ItemPosto** (N:N — quais itens cada posto recebe)
- **Entrega** (registro de entrega com anexo)
- **Assinatura** (futuro)

## Origem dos dados

Os 264 itens, 9 postos, 4 categorias e 10 colaboradores foram extraídos do arquivo `CHECKLISTS CAROLDO.xlsx` (5.7MB, 20 abas) fornecido pelo cliente. As 230 imagens dos itens também foram extraídas do mesmo Excel.
