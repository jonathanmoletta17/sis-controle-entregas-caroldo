# FISCCON — Fiscalização de Contratos Continuados (Contrato de Manutenção Predial 004/2026)

Sistema de controle de entregas de EPI/materiais a terceirizados (Estado do RS, Casa Civil). Next.js 16 (App Router) + React 19 + Prisma/PostgreSQL + NextAuth. Cada terceirizado tem um posto de trabalho; cada item tem uma meta de quantidade esperada por posto (configurada na "matriz de metas"); entregas são registradas por quantidade e o sistema acompanha saldo/percentual de conformidade.

## Gerenciador de pacotes: é Bun, não npm/yarn

**O projeto usa Bun** — só existe `bun.lock` no repo (sem `package-lock.json`/`yarn.lock`), e é isso que a Vercel usa pra instalar dependências no build de produção. `npm`/`npx` funcionam pra rodar comandos pontuais (lint, tsc, next build) em qualquer ambiente que não tenha `bun` instalado, mas **instalar/atualizar dependência com `npm install` não é equivalente** — não sincroniza o `bun.lock`, que é o que a produção realmente usa.

**Isso já causou um incidente real**: o Dependabot abriu um PR bumpando a versão do `sharp` — só editou `package.json`, porque o updater dele não entende `bun.lock`. Ficou um descompasso silencioso (manifesto pedia uma versão, lockfile resolvia outra) que só quebrou em produção, de um jeito que não aparecia rodando localmente com `npm`/`node_modules` já instalado por fora do Bun. **Depois de qualquer PR do Dependabot que mexa em dependência, rodar `bun install` e conferir se `bun.lock` mudou** — se mudou, é sinal de que estava dessincronizado.

```
npm run dev             # porta padrão 3006 — NUNCA 3000/3001 (ver "Portas locais" abaixo)
npm run build            # gera .next/standalone (next.config.ts: output "standalone")
npm run lint
npx tsc --noEmit          # rodar manualmente — ver "Gotchas" abaixo, o build NÃO pega erro de tipo
npm run db:generate | db:push | db:migrate
npm run db:normalizar-unidades   # bun scripts/normalizar_unidades.ts — idempotente
```

Runtime dos scripts (`bun scripts/...`) assume `bun`; se não tiver `bun` instalado no ambiente, os mesmos scripts rodam com `npx tsx scripts/arquivo.ts` — mas isso é só pra *rodar* o script, não substitui `bun install` pra manter o lockfile em dia.

## Banco de dados

- Apesar do `.env.example` sugerir SQLite, o schema real (`prisma/schema.prisma`) é **PostgreSQL** — sempre foi.
- **Banco de dev/teste local:** container Docker `caroldo-valida` (imagem `postgres:17-alpine`). Pode estar **parado** entre sessões — suba com `docker start caroldo-valida`. Credenciais e porta ficam no `.env` local (gitignored, não documentar aqui por ser repo público — peça pra quem já rodou o projeto ou veja `docker inspect caroldo-valida`).
- **Cuidado:** nesta máquina de desenvolvimento existe também um Postgres **nativo** (fora do Docker) escutando em `localhost:5433`, que pertence a **outro projeto** (`patrimonio`) — não tem nenhum banco/usuário deste projeto. Já confundimos isso uma vez; se `DATABASE_URL` no `.env` local não autenticar, o problema costuma ser apontar pra porta/host errado, não credencial errada.
- **Produção:** `DATABASE_URL` própria, externa, configurada como env var no projeto da Vercel — nunca existe no `.env` local. Ver `docs/ESTUDO_INFRAESTRUTURA_CONTAS_E_CAPACIDADE.md` para o levantamento completo do provedor/capacidade.

## Portas locais

Este ambiente de desenvolvimento roda vários outros projetos via Docker nas portas 3000–3005 (dashboards, buscadores etc). Este projeto usa **3006** por padrão (`package.json` → script `dev`). Antes de rodar qualquer coisa em outra porta, confirme que está livre (`ss -tlnp | grep <porta>` ou `docker ps`).

## Autenticação

- NextAuth, provider Credentials, usuários na tabela `Usuario` (`senhaHash` em bcrypt).
- `prisma/seed.ts` cria o admin inicial com **senha aleatória impressa uma única vez no console** — se perdida, não tem fluxo de "esqueci senha"; é preciso resetar `senhaHash` diretamente no banco (script Node com `bcryptjs`).
- Em produção há uma camada extra: **Vercel SSO** antes até de chegar na tela de login do app — quem não tem acesso ao time Vercel não consegue entrar, nem ver a tela de login.

## Deploy

- Hospedado na **Vercel** (plano Hobby, conta pessoal), projeto `sis-controle-entregas-caroldo`.
- **Branch de produção: `main`.** Merge/push em `main` dispara deploy automático — não existe pipeline de CI/CD separado (`.github/workflows` não existe).
- `DATABASE_URL` e `AUTH_SECRET` de produção: env vars do projeto na Vercel (dashboard), nunca no repo.
- Riscos/limitações da conta atual (titularidade pessoal, sem SLA, Blob público) estão auditados em `docs/ESTUDO_INFRAESTRUTURA_CONTAS_E_CAPACIDADE.md`.

## Decisões e gotchas conhecidos

- **`next.config.ts` tem `typescript.ignoreBuildErrors: true`** — `next build` passa mesmo com erros de tipo. Não confiar só no build; rode `npx tsc --noEmit` separadamente antes de dar como validado.
- **Unidades de medida**: lista fixa em `src/lib/unidades.ts` (`un`, `par`, `caixa`, `metro`, `litro` — removemos `jogo`/`conjunto`/`rolo` por não estarem em uso). Itens legados podem ter `unidade` numérica (herança da planilha de origem) — `scripts/normalizar_unidades.ts` converte para `"un"`, idempotente, seguro rodar mais de uma vez. **Rodar contra produção após qualquer deploy que mexa em itens/unidades** se ainda não tiver sido rodado lá.
- **Tema**: padrão é `light` (`src/components/providers/theme-provider.tsx`). A rota `/relatorio/*` sempre força `light` via `forcedTheme`, independente da escolha do usuário — é documento para impressão/PDF, precisa de contraste garantido.
- Sem alteração de schema Prisma na feature de metas por posto — usa campos que já existiam (`ItemPosto.quantidadeEsperada/obrigatorio`, `Entrega.quantidade`).
- **Renomear algo que já tem dado gravado (ex.: nome de empresa) não basta trocar o texto no código/seed.** O `upsert` do `prisma/seed.ts` casa pelo campo único (`nome`) — se a linha antiga nunca existiu com o nome novo, o upsert só *cria* uma linha nova, nunca migra a antiga. Quando a empresa contratada virou de "CAROLDO" para "ORBIS" (commit `5162ae2`), só o código/UI foi atualizado; a linha `Empresa` já gravada no banco de produção continuou com `nome = "CAROLDO"`, e qualquer tela que lê `empresa.nome` direto do banco (relatório do terceirizado, cabeçalho e assinaturas) mostrava o nome antigo. Corrigido com `scripts/renomear_empresa_caroldo_orbis.ts` (idempotente, também funciona se por algum motivo já existirem as duas linhas). **Regra geral: renomear uma entidade sempre exige um script de migração de dado além da mudança de código, se a entidade já pode ter linhas gravadas.**
- **Tela de Itens (e catálogo com imagem em geral) é sensível a performance por dois motivos que já causaram lentidão real**: (1) evite efeitos duplicados buscando o mesmo endpoint no mount — já existiu um bug em `itens.tsx` com dois `useEffect` chamando `GET /api/itens` ao mesmo tempo, e outro em que o efeito sem `.catch()` prendia a tela em loading infinito se qualquer fetch falhasse; (2) toda imagem de item (`src/lib/storage.ts`, pastas `itens` e `entregas-fotos`) é redimensionada para no máximo 800px no upload via `sharp` antes de salvar/enviar ao Blob — não reintroduzir upload de imagem sem passar por `saveUpload`. Listas de itens com `<img>` devem usar `loading="lazy"`.
- **Qualquer dependência com binário nativo (native addon, ex.: `sharp`/libvips) precisa de DUAS coisas em `next.config.ts`, não só uma**: `serverExternalPackages: ["nome-do-pacote"]` (impede o bundler de tentar empacotar o pacote — ele carrega direto do `node_modules` em runtime) **e**, como este projeto usa `output: "standalone"`, também `outputFileTracingIncludes` apontando o glob dos arquivos binários (`.so`/`.node`) que o rastreamento de arquivos do standalone não detecta sozinho (o binário é carregado via `dlopen`/caminho montado em runtime, não um `require()` estático). Faltar qualquer um dos dois quebra em produção com `ERR_DLOPEN_FAILED`, mesmo que `next dev` e um `next build` "normal" (sem checar o conteúdo de `.next/standalone`) pareçam estar OK. **Antes de declarar uma dependência nativa como funcionando, validar rodando `node` de dentro de `.next/standalone` com o `require()` real — não só `next dev`.**
