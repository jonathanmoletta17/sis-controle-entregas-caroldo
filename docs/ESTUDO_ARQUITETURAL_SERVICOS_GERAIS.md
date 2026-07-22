# Estudo arquitetural — controle de entregas de Serviços Gerais

**Data do estudo:** 15/07/2026  
**Escopo:** análise e fundação, sem implementação de regra de negócio, CRUD ou telas  
**Fontes primárias:** repositório `sis-controle-entregas-caroldo`, planilha `CHECKLISTS-CAROLDO-servicosGerais.xlsx` e briefing anexado ao task do Codex

## 1. Decisão executiva

### Recomendação

Criar **um novo repositório a partir de uma fundação arquitetural curada do sistema atual**. Na classificação pedida no briefing, isso corresponde à opção **“criar um template reutilizando somente a arquitetura”**.

Não recomendo:

- copiar integralmente o repositório atual e trocar nomes, porque isso herdaria regras que consideram um item concluído depois de uma única entrega ao colaborador;
- começar totalmente do zero, porque autenticação, autorização, auditoria, contratos, empresas, anexos, identidade visual, Prisma/PostgreSQL e a infraestrutura Next.js já são ativos úteis e testados em build;
- transformar o sistema atual no novo sistema por alteração direta, porque os dois domínios precisam evoluir e ser auditados de forma independente.

O novo repositório deve nascer de um commit de fundação contendo apenas a plataforma compartilhável, sem seed de ferramentas, uploads antigos, dashboards de pendência individual nem semântica de `ItemPosto`/`Entrega`.

### Por que a cópia literal falharia

O núcleo atual responde à pergunta:

> “Este colaborador já recebeu este item?”

Serviços Gerais exige responder perguntas diferentes:

> “Qual obrigação estava vigente nesta competência, quanto era devido, quanto foi recebido e aceito, quanto ficou pendente, quanto havia em estoque e qual decisão justificou eventual não reposição?”

Essa diferença muda a chave de completude. No sistema atual, a chave lógica é aproximadamente:

`colaborador + item`

No novo domínio, a chave principal deve ser aproximadamente:

`contrato + obrigação + competência + destino`

e cada recebimento pode ter várias linhas, entregas parciais, saldos, rejeições e ajustes.

## 2. Evidências analisadas

### 2.1 Repositório atual

- Branch: `main`, alinhada com `origin/main` no commit `c4c9860` durante o estudo.
- Stack: Next.js 16, React 19, TypeScript, Prisma 6, PostgreSQL, Auth.js, Vercel Blob e componentes Radix/shadcn.
- O histórico tem 25 commits alcançáveis a partir de `main`, incluindo migração PostgreSQL/Blob, autenticação, auditoria, permissões, correções de produção e rebranding institucional.
- O schema contém 15 modelos: identidade/auditoria, contratos/empresas, postos/colaboradores, catálogo, entregas e assinaturas.
- O seed original representa 9 postos, 4 categorias, 34 mapeamentos posto–categoria, 264 itens únicos e 521 ocorrências de item por posto/categoria.
- Não existe diretório versionado `prisma/migrations`; a operação ainda depende de `db push`/seed, o que é insuficiente como trilha evolutiva do novo sistema.
- A dependência `z-ai-web-dev-sdk` está declarada, mas não foi encontrada em uso dentro de `src` ou `prisma`.

### 2.2 Planilha de Serviços Gerais

A planilha possui 14 abas:

**Arquivo analisado:** 2.010.905 bytes; SHA-256 `60a034e2d73a9ccf5550c8965cf7de49bfd14399b6fb21b1e6bf25698319012f`.

1. Materiais mensais;
2. Máquinas e equipamentos;
3. Equipamentos de jardinagem;
4. Equipamentos de serventes;
5. Uniformes/EPI de serventes;
6. Uniformes/EPI de jardineiros;
7. Uniformes/EPI de ASGs;
8. Uniformes/EPI de mensageiros;
9. Uniformes/EPI de supervisão masculina;
10. Uniformes/EPI de supervisão feminina;
11. Uniformes de recepção masculina;
12. Uniformes de recepção feminina;
13. Uniformes de copeiras;
14. Documentação por função.

Todas as abas foram renderizadas e inspecionadas visualmente. A pasta de origem não foi alterada. A planilha não contém fórmulas: os resultados e estados são registros manuais.

#### Quantificação da aba “MATERIAIS MENSAIS”

- 65 itens cadastrados;
- 38 itens classificados como mensais sem outra cadência explícita;
- 1 item com reposição bimestral;
- 24 itens com reposição trimestral, frequentemente acompanhada de “ou quando necessário”;
- 1 item com reposição semestral;
- 1 item condicionado somente a avaria/substituição;
- 389 células preenchidas no histórico de entrega analisado;
- 227 registros com data (data real do Excel ou texto de data);
- 73 marcações negativas (`Não`, `NÂO` e variações);
- 57 marcações `ok`/`sim`;
- 28 registros de saldo (`Ainda temos`);
- 3 registros em que a quantidade recebida foi escrita no lugar do estado/data;
- 1 registro desconhecido (`??????`).

Essas contagens classificam o conteúdo textual existente; não significam 389 entregas formais. Uma única célula pode representar data, decisão, saldo ou quantidade.

#### O que a planilha revela sobre o domínio

1. **O catálogo não é só de consumíveis.** Há consumíveis, utensílios de reposição, bens duráveis, máquinas, EPI, uniformes e documentos.
2. **Quantidade e periodicidade estão misturadas.** Exemplo: “15 litros/mês — reposição trimestral”. Não é possível concluir sem validação se são 15 litros por entrega trimestral ou 45 litros acumulados.
3. **Há demanda híbrida.** Alguns itens têm cadência e, ao mesmo tempo, reposição por necessidade, avaria ou saldo.
4. **Saldo interfere na obrigação operacional.** “Ainda temos” não é uma entrega e tampouco deveria equivaler a uma pendência automática; é uma decisão baseada em estoque.
5. **Recebimento pode ser parcial.** Há registros como “só 8 unidades”, “veio 76” e “apenas 2 unidades”.
6. **O status atual é semiestruturado.** Data, `ok`, `sim`, `não`, saldo e quantidade ocupam as mesmas colunas.
7. **Há regras contratuais.** Máquinas/ferramentas danificadas devem ser substituídas em até 24 horas e a fiscalização deve ser comunicada.
8. **EPI/uniforme é orientado por função e variante.** Tamanho, sexo/modelagem, cor, norma regulamentadora e quantidade por pessoa importam.
9. **Documentação é orientada por colaborador/função.** Escolaridade, experiência, ASO, PGR/PCMSO, NRs e cursos têm requisitos distintos.
10. **Há divergência temporal de contrato.** Várias abas ainda citam `003/2025`, enquanto o sistema atual foi renomeado para o contrato `004/2026`. A origem e vigência de cada regra precisam ser confirmadas antes da importação.

## 3. Arquitetura atual: o que existe e como funciona

### 3.1 Fluxo principal

1. O usuário autentica por credenciais no Auth.js.
2. O proxy exige sessão em todas as rotas que não são públicas.
3. Perfis `admin` e `tecnico` podem mutar; `leitura` só consulta.
4. Um colaborador pertence a empresa, contrato e posto.
5. Um item pertence a uma categoria e é associado a postos por `ItemPosto`.
6. Uma entrega associa colaborador, item, data e quantidade.
7. O checklist considera o item entregue quando existe ao menos uma `Entrega` para aquele colaborador/item.
8. Pendências são calculadas por pares colaborador–item.
9. Alterações relevantes geram `AuditLog`; anexos podem ser locais ou Vercel Blob.

### 3.2 Pontos fortes reutilizáveis

| Capacidade | Decisão | Observação |
|---|---|---|
| Auth.js e sessão JWT | Reutilizar | Boa fundação, exigindo revisão de segurança e testes. |
| Usuários e perfis | Reutilizar/adaptar | Manter RBAC; futuramente separar permissões por capacidade. |
| Auditoria | Reutilizar/adaptar | Acrescentar correlação, motivo e eventos de domínio. |
| Contrato e empresa | Reutilizar/adaptar | Tornar escopo contratual explícito em todas as obrigações. |
| Upload/anexos | Reutilizar | Manter interface de storage e trocar detalhes apenas se necessário. |
| Identidade visual e layout | Reutilizar | Sem copiar as telas de negócio. |
| Prisma/PostgreSQL | Reutilizar | Adotar migrations versionadas desde o primeiro commit. |
| Relatório e impressão | Reutilizar como referência | Recriar relatórios segundo competências e recebimentos. |
| Infra Next.js | Reutilizar | Manter monólito modular; não há justificativa atual para microserviços. |

### 3.3 Componentes que não podem ser reutilizados como regra

| Componente atual | Problema no novo domínio | Tratamento |
|---|---|---|
| `ItemPosto.quantidadeEsperada` | É inteiro, individual e sem vigência/cadência/unidade de medida. | Substituir por obrigação contratual versionada. |
| `Entrega` | Exige colaborador e não possui competência, destino, aceite, parcialidade nem saldo. | Recriar como recebimento + linhas. |
| Checklist | `entregue = entregas.length > 0`; nunca volta a vencer. | Recriar por competência/obrigação. |
| Pendências | Par colaborador–item, sem janela temporal. | Recriar por obrigação, prazo e saldo. |
| Dashboard | Conta entregas, não cumprimento contratual. | Recriar KPIs de competência, cobertura, atraso e divergência. |
| Catálogo | `unidade` é texto sanitizado para dígitos na criação. | Criar unidade de medida e embalagem estruturadas. |
| Seed antigo | Ferramentas e postos do contrato anterior. | Não copiar; construir importador novo, validado e idempotente. |
| Assinatura | Está ligada a colaborador/entrega individual. | Permitir assinatura de recebimento/lote/termo. |

### 3.4 Débitos técnicos observados

- `next build` conclui, mas informa que a validação de tipos foi ignorada.
- `tsc --noEmit` falha por dependências ausentes nos exemplos de WebSocket e três erros reais em `src`.
- O lint direcionado a `src` e `prisma` passa, mas várias regras relevantes estão desativadas.
- O lint global percorre worktrees e artefatos aninhados porque os ignores não cobrem `.claude/worktrees/**` adequadamente.
- A configuração local aponta para PostgreSQL em `localhost:5433`, indisponível durante o estudo; por isso não foi possível validar contagens do banco vivo.
- `.env.example` ainda descreve SQLite, embora o schema use PostgreSQL.
- A camada de domínio está embutida diretamente nas rotas de API; não há serviços de aplicação, repositórios por interface ou testes automatizados encontrados.
- O dashboard atual conta entregas do posto sem limitar aos itens esperados daquele posto; a matriz de pendências é mais correta, mas ambos continuam sem temporalidade.
- O projeto não tem um comando `check` que agregue schema, lint, typecheck e testes.

Esses débitos não impedem o reaproveitamento da fundação, mas impedem tratá-la como template pronto sem uma fase de saneamento.

## 4. Modelo conceitual proposto

Os nomes abaixo são conceituais. A nomenclatura definitiva deve ser fechada em glossário com a fiscalização.

### 4.1 Núcleo contratual e catálogo

**Contrato**  
Número, objeto, empresa responsável, vigência, unidade gestora, status e versão.

**Local/Destino**  
Prédio, unidade, almoxarifado, setor ou outro ponto que recebe/consome material.

**Produto**  
Código estável, nome, classe (`CONSUMIVEL`, `UTENSILIO`, `MAQUINA`, `EPI`, `UNIFORME`, `DOCUMENTO`), especificação, unidade de medida, embalagem, marca apenas como referência quando contratualmente admitida, imagem e status.

**Variante de produto**  
Tamanho, cor, capacidade, gênero/modelagem, norma, voltagem ou outra dimensão que altere a obrigação/estoque.

**Obrigação contratual**  
Contrato, produto/variante, escopo, quantidade-base, unidade, vigência, regra de periodicidade, dia/prazo, tolerância, proporcionalidade, possibilidade de saldo, regra de substituição e SLA.

### 4.2 Planejamento e competência

**Regra de recorrência**  
Mensal, bimestral, trimestral, semestral, sob demanda, por avaria ou combinação explicitamente permitida.

**Competência**  
Período ao qual a obrigação pertence, independente da data física do recebimento.

**Obrigação da competência**  
Snapshot imutável da regra vigente: quantidade devida, prazo, destino e estado (`PLANEJADA`, `DEVIDA`, `PARCIAL`, `ATENDIDA`, `ATRASADA`, `DISPENSADA_JUSTIFICADA`, `CANCELADA`).

Não se deve recalcular o passado quando a regra contratual mudar.

### 4.3 Recebimento, inspeção e estoque

**Recebimento**  
Cabeçalho do evento: contrato, fornecedor, data/hora, destino, documento fiscal/termo, responsável, anexos e assinaturas.

**Linha de recebimento**  
Produto/variante, competência atendida, quantidade entregue, aceita, rejeitada e observações.

**Não conformidade**  
Tipo, evidência, quantidade afetada, prazo de correção, notificação e situação. Deve suportar o SLA de 24 horas das máquinas/ferramentas.

**Movimento de estoque**  
Entrada, saída/consumo, transferência, ajuste, perda, devolução ou reserva; nunca sobrescrever saldo diretamente.

**Saldo**  
Projeção derivada dos movimentos por produto, variante e local. “Ainda temos” passa a ser evidência quantitativa, não texto livre.

### 4.4 Distribuição individual e conformidade

**Alocação individual**  
Entrega de uniforme/EPI/documento a colaborador, sem confundir com recebimento contratual no almoxarifado.

**Requisito por função**  
Função, produto/documento, quantidade, validade, norma e obrigatoriedade.

**Documento do colaborador**  
Tipo, emissão, validade, arquivo, situação de conferência e vínculo com requisito.

Esse recorte permite que o mesmo sistema controle o recebimento do fornecedor e a distribuição interna sem misturar os dois fatos.

## 5. Regras implícitas que precisam virar decisões explícitas

| Evidência da planilha | Pergunta obrigatória | Representação sugerida |
|---|---|---|
| `80 litros/mês` | Quantidade é por contrato, local ou equipe? | `quantidadeBase` + `escopo`. |
| `15 litros/mês; reposição trimestral` | A entrega trimestral é 15 ou 45 litros? | Separar base mensal e quantidade por ciclo; bloquear cálculo até decisão. |
| `proporcional` | Qual fórmula e quais datas de corte? | Política de proporcionalidade versionada. |
| `Ainda temos` | Qual saldo mínimo permite postergar? Quem autoriza? | Saldo + decisão formal + responsável. |
| `Não` | Não entregue, não devido, não solicitado ou rejeitado? | Motivo enumerado obrigatório. |
| `ok`/`sim` | Foi entregue quanto, quando e aceito por quem? | Recebimento estruturado. |
| `só 8 unidades` | O restante permanece pendente? | Linha parcial + saldo pendente. |
| `quando necessário` | Quem abre a demanda e qual o prazo? | Solicitação sob demanda + SLA. |
| `mediante avaria` | O item avariado é identificado? | Ocorrência + ativo/lote + substituição. |
| `tamanho P/M/G` | Há saldo e obrigação por variante? | Variante obrigatória. |
| NRs/cursos | Possuem validade e evidência individual? | Requisito + documento + vencimento. |

Nenhuma dessas respostas deve ser inferida apenas da planilha.

## 6. Comparação completa entre os sistemas

| Dimensão | Ferramentas atual | Serviços Gerais proposto |
|---|---|---|
| Objeto principal | Kit/item por colaborador | Obrigação contratual por competência e destino |
| Natureza | Predominantemente durável | Híbrida: consumível, durável, EPI, uniforme e documento |
| Frequência | Entrega inicial e substituição eventual | Recorrência + demanda + substituição |
| Conclusão | Já recebeu alguma vez | Quantidade devida atendida na competência |
| Quantidade | Inteiro por colaborador | Decimal, unidade de medida, embalagem e variante |
| Destino | Colaborador/posto | Contrato, local, equipe e, em alguns fluxos, colaborador |
| Estoque | Ausente | Livro de movimentos e saldo por local |
| Parcialidade | Registro simples | Devido, entregue, aceito, rejeitado e pendente |
| Prazo | Data de entrega | Competência, vencimento e SLA |
| Exceções | Observação livre | Motivo e decisão auditável |
| Dashboard | Contagem de cadastros/entregas | Cumprimento, atraso, cobertura, consumo e não conformidade |
| Documentos | Item entregue | Requisito com evidência, validade e conferência |
| Assinatura | Por entrega/lote individual | Por recebimento, termo, alocação ou decisão |

## 7. Estrutura recomendada do novo repositório

```text
sis-controle-servicos-gerais/
├── .codex/
│   └── config.toml
├── .github/
│   └── workflows/ci.yml
├── docs/
│   ├── adr/
│   ├── domain/
│   │   ├── glossary.md
│   │   ├── rules-catalog.md
│   │   └── open-decisions.md
│   ├── architecture/
│   │   ├── context.md
│   │   ├── data-model.md
│   │   └── import-strategy.md
│   └── runbooks/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seeds/
├── scripts/
│   ├── import/
│   └── validation/
├── src/
│   ├── app/                    # composição Next, rotas e páginas
│   ├── modules/
│   │   ├── identity/
│   │   ├── contracts/
│   │   ├── catalog/
│   │   ├── planning/
│   │   ├── receiving/
│   │   ├── inventory/
│   │   ├── allocations/
│   │   ├── compliance/
│   │   └── reporting/
│   ├── shared/
│   │   ├── application/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── ui/
│   └── test/
├── AGENTS.md
├── .env.example
├── package.json
└── README.md
```

### Convenção interna por módulo

```text
module/
├── domain/          # entidades, valores, invariantes e eventos
├── application/     # casos de uso e portas
├── infrastructure/  # Prisma, storage e integrações
├── http/            # schemas e adaptadores de rota
├── ui/              # componentes específicos
└── tests/
```

Manter um monólito modular. Extração para serviços separados só deve ocorrer diante de necessidade operacional comprovada.

## 8. Dependências e configuração

### Manter na fundação

- Next.js, React e TypeScript;
- Prisma Client e PostgreSQL;
- Auth.js e `bcryptjs`;
- Zod para contratos de entrada/saída;
- `date-fns` para datas de apresentação, mantendo regras de competência em funções de domínio testadas;
- Vercel Blob atrás de uma interface de storage;
- componentes Radix/shadcn estritamente usados;
- biblioteca de geração de identificadores apenas se necessária.

### Remover da fundação até existir uso real

- `z-ai-web-dev-sdk`;
- exemplos WebSocket e dependências não instaladas;
- editores, drag-and-drop, carrosséis e bibliotecas de UI sem consumidor;
- seed, imagens e uploads do contrato de ferramentas;
- scripts de correção pontual do contrato antigo.

### Adicionar quando a implementação começar

- Vitest para domínio e aplicação;
- Testing Library para componentes críticos;
- Playwright para fluxos ponta a ponta;
- ferramenta de cobertura com meta gradual;
- validação de arquitetura/import boundaries, se o time demonstrar necessidade.

### Variáveis de ambiente mínimas

```text
DATABASE_URL=
AUTH_SECRET=
BLOB_READ_WRITE_TOKEN=
APP_BASE_URL=
UPLOAD_MAX_BYTES=
```

O `.env.example` deve refletir PostgreSQL desde o início e nunca conter credenciais reais.

## 9. Scripts e gates de qualidade

Scripts mínimos propostos:

| Script | Finalidade |
|---|---|
| `dev` | desenvolvimento local |
| `build` | build de produção |
| `lint` | lint apenas em fontes versionadas |
| `typecheck` | `tsc --noEmit` obrigatório |
| `test` | testes unitários |
| `test:integration` | casos com banco isolado |
| `test:e2e` | fluxos críticos no navegador |
| `db:validate` | validar schema Prisma |
| `db:migrate` | criar migration local |
| `db:deploy` | aplicar migrations em ambiente |
| `db:seed` | seed mínimo e idempotente |
| `import:validate` | validar planilha sem persistir |
| `import:dry-run` | gerar relatório de transformação |
| `check` | schema + lint + typecheck + testes |

Nenhum merge em `main` deve ocorrer com `check` vermelho. O build não pode substituir o typecheck.

## 10. Estratégia de dados e migração

1. Congelar uma cópia hashada da planilha fonte.
2. Criar dicionário de dados e glossário aprovados pela fiscalização.
3. Transformar cada aba em staging tabular sem escrever no banco.
4. Gerar relatório de anomalias: datas textuais, `ok`, `não`, saldos, parcialidades, duplicidades e contratos divergentes.
5. Resolver decisões abertas com responsáveis identificados.
6. Importar catálogo e obrigações com identificadores externos estáveis.
7. Gerar competências apenas após validar vigência e regra de cálculo.
8. Importar histórico como eventos legados, preservando o texto original e o grau de confiança.
9. Reconciliar amostras manualmente com a planilha.
10. Executar piloto paralelo por uma ou duas competências antes do corte.

O importador deve ser idempotente e manter `sourceFile`, `sourceSheet`, `sourceRow`, hash e payload original para auditoria.

## 11. Estratégia de versionamento

- Repositório novo, com referência no README ao commit-base do sistema atual.
- `main` protegida, PR obrigatória e CI verde.
- Conventional Commits para histórico legível.
- SemVer a partir de `0.1.0` durante descoberta/piloto; `1.0.0` apenas após regras e migração validadas.
- Migrations Prisma imutáveis depois de aplicadas em ambiente compartilhado.
- ADR para decisões arquiteturais; catálogo de regras para decisões de domínio.
- Releases com changelog, migration notes, rollback e evidência de validação.
- Branches curtas; worktrees separados para frentes paralelas.

## 12. Plano de desenvolvimento por fases

### Fase 0 — Descoberta e decisões

Entregáveis: glossário, mapa de processos, donos das decisões, matriz de periodicidade, regra de proporcionalidade, escopos/destinos, status e critérios de aceite.

**Gate:** nenhuma ambiguidade crítica da tabela da seção 5 permanece sem dono e prazo.

### Fase 1 — Fundação limpa

Extrair autenticação, autorização, auditoria, contratos, empresas, storage, observabilidade, CI, migrations e testes básicos para o novo repositório.

**Gate:** `check` e build verdes, banco efêmero reproduzível e nenhuma dependência/seed do domínio antigo.

### Fase 2 — Catálogo e obrigações

Implementar produto, variante, unidade, embalagem, destino, obrigação, vigência e recorrência.

**Gate:** exemplos reais da planilha são representáveis sem texto mágico.

### Fase 3 — Competências e motor de vencimento

Gerar snapshots por competência, prazos, estados e cálculo de pendência.

**Gate:** testes cobrem mensal, bimestral, trimestral, semestral, vigência parcial e alteração futura de regra.

### Fase 4 — Recebimento, inspeção e estoque

Registrar recebimentos parciais, aceite/rejeição, não conformidade, anexos, assinaturas e movimentos.

**Gate:** reconciliação quantitativa fecha para amostras reais e nenhum saldo é alterado sem movimento.

### Fase 5 — Alocação individual e documentos

Cobrir EPI, uniforme, variantes, entrega individual e conformidade documental.

**Gate:** recebimento contratual e distribuição interna permanecem fatos separados e conciliáveis.

### Fase 6 — Relatórios e operação

Dashboards de cumprimento por competência, atrasos, parcialidades, estoque, consumo, SLA e não conformidades.

**Gate:** indicadores reconciliam com consultas auditáveis e amostras da fiscalização.

### Fase 7 — Migração, piloto e corte

Dry-run, importação, operação paralela, treinamento, aceite, rollback e desativação controlada da planilha.

**Gate:** duas competências reconciliadas ou critério equivalente formalmente aprovado.

## 13. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Interpretar “mensal + trimestral” incorretamente | Cobrança/estoque errados | Decisão formal antes do motor de recorrência. |
| Tratar `Não` como um único estado | Indicadores falsos | Motivos enumerados e auditáveis. |
| Copiar semântica de entrega única | Pendências desaparecem após o primeiro mês | Competência obrigatória. |
| Vincular todo consumo a colaborador | Modelo artificial e dados duplicados | Escopo polimórfico controlado por obrigação. |
| Não modelar estoque | “Ainda temos” continua texto informal | Livro de movimentos e saldos. |
| Não separar recebido de aceito | Material inadequado aparece como cumprido | Quantidades entregue/aceita/rejeitada. |
| Importar dados antigos sem proveniência | Perda de auditabilidade | Staging, hash, linha de origem e payload legado. |
| Contrato 003/2025 versus 004/2026 | Regras aplicadas à vigência errada | Validar contrato e versionar obrigação. |
| Ausência de migrations/testes | Regressão e deploy não reprodutível | Fase 1 obrigatória. |
| Banco local indisponível | Diagnóstico incompleto do estado vivo | Subir ambiente documentado e repetir auditoria read-only. |
| Escopo crescer para RH/almoxarifado completo | Projeto perde foco | Contextos delimitados e roadmap explícito. |

## 14. Codex App versus ZAI

### Conclusão imparcial

Não há limitação técnica identificada que exija entregar a arquitetura ao ZAI antes de continuar no Codex.

O Codex atual oferece planejamento, Goal mode para trabalho longo, leitura/produção de arquivos, execução em WSL e worktrees para tarefas paralelas isoladas. A documentação oficial recomenda explicitar objetivo, contexto, restrições e definição de pronto, planejar antes de tarefas complexas, persistir convenções em `AGENTS.md` e exigir testes/revisão. Essas capacidades são suficientes para esta migração arquitetural.

Fontes oficiais consultadas:

- [Best practices do Codex](https://learn.chatgpt.com/guides/best-practices.md)
- [Prompting](https://learn.chatgpt.com/docs/prompting.md)
- [Long-running work e Goal mode](https://learn.chatgpt.com/docs/long-running-work.md)
- [Worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)
- [WSL](https://learn.chatgpt.com/docs/windows/wsl.md)
- [Trabalho com arquivos](https://learn.chatgpt.com/docs/artifacts-viewer.md)

### Limites reais do Codex neste projeto

- não pode decidir sozinho a interpretação contratual ambígua;
- não deve inventar a regra de proporcionalidade;
- não substitui homologação da fiscalização, jurídico, segurança do trabalho ou almoxarifado;
- precisa de banco/ambiente acessível para validar o estado vivo;
- precisa de testes e critérios de aceite para evitar que uma implementação plausível, porém incorreta, seja aceita.

Esses limites também se aplicariam a outro modelo.

### Quando o ZAI faria sentido

- como fonte de contexto se houver conversas/ADRs não presentes no repositório;
- como segunda revisão independente de uma decisão já documentada;
- para comparar alternativas em um spike sem escrita concorrente no mesmo checkout.

### Riscos de transferir a arquitetura ao ZAI agora

- recomeçar a descoberta e perder evidências já extraídas;
- introduzir uma segunda nomenclatura sem glossário comum;
- confundir familiaridade com a arquitetura antiga com adequação ao domínio novo;
- criar divergência entre documentos e implementação.

### Momento adequado para voltar ao Codex, caso o ZAI seja usado

Após produzir um artefato verificável: ADR, modelo, invariantes, decisões abertas e critérios de aceite. O retorno não deve depender de um resumo informal.

## 15. Decisões que precisam do usuário/fiscalização antes de codificar

1. O sistema novo cobre somente materiais mensais ou todas as 14 abas?
2. Qual é o contrato correto e a vigência de cada aba?
3. Quantidade “por mês” é por contrato, local, equipe, posto ou colaborador?
4. Em “mensal + trimestral”, qual quantidade é devida por ciclo?
5. Como funciona a proporcionalidade do primeiro/último mês?
6. “Ainda temos” pode dispensar entrega contratual ou apenas registrar saldo?
7. Quem autoriza postergação e qual saldo mínimo é exigido?
8. Quais motivos distinguem não devido, não solicitado, não entregue e rejeitado?
9. Quais locais/almoxarifados existem?
10. A distribuição de EPI/uniforme e os documentos devem entrar na primeira versão?
11. Quais assinaturas possuem valor formal e em que granularidade?
12. Qual ambiente será a fonte viva de dados para migração e homologação?

## 16. Critério de pronto da etapa arquitetural

Esta primeira etapa pode ser considerada concluída quando:

- a estratégia de template/fundação for aprovada;
- as 12 decisões acima tiverem resposta ou responsável/prazo;
- o glossário e o mapa de estados forem aceitos;
- a fundação do novo repositório estiver definida sem regras antigas;
- o modelo representar amostras das 14 abas;
- scripts e gates de qualidade estiverem acordados;
- o plano de migração tiver proveniência, dry-run e reconciliação;
- nenhum código de negócio tiver sido iniciado antes dessas aprovações.

## 17. Evidências de validação desta análise

| Verificação | Resultado em 15/07/2026 |
|---|---|
| Planilha importada pelo runtime oficial de artefatos | Sucesso |
| Render visual das 14 abas | Sucesso |
| Fórmulas na planilha | Nenhuma encontrada |
| `prisma validate` | Sucesso |
| Lint direcionado a `src` e `prisma` | Sucesso |
| Build Next de produção | Sucesso; validação de tipos ignorada pelo build |
| `tsc --noEmit` | Falha: exemplos WebSocket sem dependências e 3 erros em `src` |
| Conexão read-only com banco configurado | Bloqueada: `localhost:5433` indisponível |
| Estado Git antes do relatório | `main` alinhada com `origin/main`, sem alterações versionadas |

## 18. Próximo passo recomendado

Realizar uma sessão curta de decisão de domínio usando a seção 15 como pauta. Depois, criar apenas a **Fase 1 — Fundação limpa** em novo repositório, sem CRUDs de materiais. O primeiro artefato executável deve ser um `check` verde com schema inicial versionado, testes de infraestrutura e documentação; o motor de recorrência só começa após o fechamento das ambiguidades contratuais.

## 19. Adendo de infraestrutura e capacidade gratuita

A auditoria de 15/07/2026 confirmou que a produção atual está em uma equipe Vercel Hobby pessoal, com um único proprietário, dois projetos e uma store Blob pública. A store possui 9 objetos e 15,3 MB; tecnicamente há folga para outro piloto pequeno, mas a configuração atual não oferece titularidade institucional, SLA, retenção suficiente de logs nem armazenamento privado para documentos.

O PostgreSQL em `localhost:5433` é somente o ambiente local. Produção possui uma `DATABASE_URL` externa e sensível; o provedor não pôde ser certificado porque a Vercel não devolve o conteúdo após a variável ser marcada como sensível. Neon é a hipótese documentada no histórico, não uma confirmação da conta viva.

O parecer detalhado, os limites atuais, cenários de crescimento, custos e gates para produção estão em [Estudo de infraestrutura, contas e capacidade gratuita](./ESTUDO_INFRAESTRUTURA_CONTAS_E_CAPACIDADE.md).
