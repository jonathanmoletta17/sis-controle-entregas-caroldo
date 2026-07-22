# Estudo de infraestrutura, contas e capacidade gratuita

**Data de corte:** 15/07/2026

**Escopo:** Vercel, Vercel Blob, PostgreSQL/Neon, persistência de imagens e documentos, titularidade, capacidade, continuidade, segurança e custos do sistema atual e do futuro sistema de Serviços Gerais.

**Natureza:** auditoria somente de leitura; nenhuma conta, projeto, store, variável, deploy ou dado foi alterado.

## 1. Resposta executiva

### A resposta curta

As tecnologias são adequadas, mas a configuração gratuita atual **não deve ser tratada como garantia de uma aplicação institucional sólida e consistente**.

- **Vercel:** a conta real está no plano Hobby e tem folga técnica para mais uma aplicação pequena. Porém, Hobby não oferece SLA, pode interromper recursos ao atingir cotas e os termos permitem desabilitar projetos. A conta também é pessoal, com um único proprietário.
- **Vercel Blob:** a store atual ocupa apenas 15,3 MB de 1 GB incluído, mas é pública. A capacidade é ampla para imagens de catálogo; não é uma arquitetura aceitável para documentos, assinaturas, fotos operacionais ou dados pessoais sem store privada e autorização de leitura.
- **Banco:** o ambiente local usa PostgreSQL em `localhost:5433`; a produção tem uma `DATABASE_URL` externa e sensível. O provedor não pôde ser certificado porque a Vercel não devolve o valor de variáveis marcadas como sensíveis. O histórico recomenda Neon, mas isso é intenção de implantação, não prova do provedor vivo.
- **Neon Free, se for de fato o banco usado:** suporta tecnicamente um piloto pequeno em um projeto separado, mas o próprio fornecedor posiciona o plano Free para protótipos, side projects e experimentos. Ele tem 0,5 GB por projeto, 100 CU-h por projeto, 5 GB/mês de saída, scale-to-zero obrigatório, restauração de apenas 6 horas, suporte comunitário e nenhum SLA.
- **Novo sistema:** pode nascer em cotas gratuitas **somente para desenvolvimento e homologação sem dados pessoais reais**. Para operação institucional, a recomendação mínima é transferir a titularidade para uma organização, usar Vercel Pro, Blob privado e banco com plano/backup compatíveis com o risco aceito.

### Decisão recomendada por fase

| Fase | Deploy | Banco | Arquivos | Decisão |
|---|---|---|---|---|
| Descoberta/desenvolvimento | Vercel Hobby | Neon Free em projeto novo | Store privada de teste, sem dados reais | Aceitável temporariamente. |
| Homologação controlada | Preferir Vercel Pro | Neon Free apenas com aceite explícito do risco, ou Launch | Blob privado em região definida | Aceitável com backup externo, monitoramento e dados minimizados. |
| Produção institucional | Vercel Pro no mínimo | Neon Launch no mínimo; Scale se SLA/controles avançados forem obrigatórios | Blob privado, URLs temporárias e retenção | Recomendado. |
| Produção com SLA formal | Vercel Enterprise | Neon Scale | Storage/observabilidade conforme requisitos | Necessário avaliar comercialmente. |

**Conclusão central:** a conta atual provavelmente comporta o volume inicial, mas capacidade bruta não resolve titularidade, disponibilidade, privacidade, recuperação de desastre e termos de uso. Para o novo sistema, “caber no grátis” não pode ser o critério de aprovação para produção.

## 2. O que foi comprovado na conta Vercel atual

### 2.1 Conta, plano e titularidade

Consulta autenticada e somente de leitura confirmou:

| Evidência | Estado em 15/07/2026 |
|---|---|
| Equipe Vercel | `jonathanmoletta17s-projects` |
| Plano | Hobby, ativo |
| Cobrança | USD; sem período/plano pago ativo |
| Membros | 1 |
| Papel do único membro | Owner |
| E-mail de faturamento | Conta pessoal do proprietário |
| Projetos | 2: sistema atual e `pedrinho` |
| Builds concorrentes | 1 |

O projeto e o repositório GitHub estão sob identidades pessoais. Isso cria um risco de continuidade maior que o risco de capacidade: afastamento, perda de acesso, troca de função ou indisponibilidade de uma única pessoa podem interromper deploy, recuperação e administração.

### 2.2 Projeto em produção

| Evidência | Estado |
|---|---|
| Projeto | `sis-controle-entregas-caroldo` |
| Framework | Next.js |
| Plano do deployment | Hobby |
| Branch de produção | `main` |
| Repositório | GitHub privado, pertencente ao usuário pessoal |
| Região padrão das Functions | `iad1` — Washington, D.C. |
| Estado do último deployment | `READY` e promovido para produção |
| Proteção externa | Vercel SSO antes da autenticação da aplicação |

Uma requisição sem sessão para a produção retorna redirecionamento à autenticação da Vercel. Isso reduz exposição acidental hoje, mas também significa que usuários operacionais sem acesso à equipe Vercel não conseguem chegar à tela de login do sistema. Essa camada precisa ser uma decisão consciente antes do piloto.

### 2.3 Atividade de deploy observada

Nos últimos 30 dias consultados:

- 25 deployments;
- 21 de produção e 4 previews;
- 25 em estado `READY`;
- duração observada entre início de build e prontidão: 32,7 a 81,0 segundos;
- média observada: 47,6 segundos;
- soma aproximada dessa duração: 19,8 minutos.

Essa soma não é a métrica oficial de faturamento de build, mas prova que a atividade recente é muito pequena diante dos 6.000 minutos de execução de build e 100 deployments/dia documentados para Hobby. A consulta `vercel usage` devolveu `Costs not found (404)`, coerente com uma equipe Hobby sem ciclo de cobrança; por isso não há neste estudo uma leitura oficial consolidada de CPU, memória, invocações e transferência.

### 2.4 Variáveis de produção

Foram confirmados apenas os nomes e escopos, nunca os segredos:

| Variável | Escopo | Situação |
|---|---|---|
| `AUTH_SECRET` | produção | sensível |
| `DATABASE_URL` | produção e preview | sensível |
| `BLOB_STORE_ID` | produção e preview | integração Blob |
| `BLOB_WEBHOOK_PUBLIC_KEY` | produção e preview | integração Blob |

A `DATABASE_URL` foi criada manualmente, não aparece vinculada a uma integração Vercel Marketplace e não pode ser recuperada pela API/CLI após ser marcada como sensível. Logo:

- é possível afirmar que produção **não depende do PostgreSQL local**;
- é possível afirmar que existe configuração para um banco externo;
- não é possível afirmar, com a evidência disponível, que esse banco é Neon em vez de outro PostgreSQL gerenciado;
- não é possível auditar plano, uso, tamanho, região, backups ou titularidade do suposto Neon sem acesso autenticado ao console/API daquela conta.

O commit `9f9c8ce` migrou o schema de SQLite para PostgreSQL e documentou Neon como recomendação, com Supabase como alternativa. Isso sustenta a hipótese Neon, mas não substitui a confirmação do host vivo.

## 3. Persistência real de arquivos

### 3.1 Store Vercel Blob atual

| Evidência | Estado em 15/07/2026 |
|---|---|
| Nome | `sis-controle-entregas-carol-blob` |
| Região | `iad1` — Washington, D.C. |
| Acesso | **Público** |
| Objetos | 9 |
| Tamanho atual | 15.339.126 bytes — 15,3 MB decimais |
| Quota excedida | Não |
| Projetos conectados | 1 |

Contra o limite Hobby de 1 GB/mês, a ocupação instantânea é aproximadamente **1,53%**. Há cerca de 984,7 MB nominais de folga, sem considerar a média GB-mês e qualquer crescimento dos dois projetos da equipe.

### 3.2 Arquivos versionados no repositório

O repositório contém ainda:

- 244 arquivos em `public/uploads`;
- 5.309.936 bytes — 5,06 MiB;
- 239 imagens de itens;
- 4 anexos;
- 1 foto de entrega.

Esses arquivos não estão na store: eles entram no deployment como ativos estáticos. A rota `/uploads/**` é excluída do middleware de autenticação. Portanto, qualquer anexo ou foto colocado ali fica acessível a quem conhecer a URL, mesmo que as páginas da aplicação exijam login.

### 3.3 O problema de segurança

O helper `src/lib/storage.ts` envia `itens`, `anexos` e `entregas-fotos` para o Blob com `access: 'public'`. Segundo a documentação da Vercel, qualquer pessoa com a URL consegue ler um Blob público. A proteção SSO do site e a sessão Auth.js não protegem diretamente essas URLs.

Essa configuração pode ser aceitável para imagem ilustrativa de catálogo. Não é aceitável como padrão para:

- documentos de colaborador;
- ASO, PGR/PCMSO, certificados e comprovantes;
- anexos com CPF ou outros dados pessoais;
- assinaturas;
- fotos que identifiquem pessoas, ambientes ou ocorrências internas;
- notas, termos e evidências de fiscalização.

Vercel Private Blob está disponível em todos os planos e, desde 30/06/2026, é recurso geral com URLs assinadas. O modo de acesso de uma store não pode ser alterado depois de sua criação. Assim, o novo sistema deve criar uma store privada nova; não deve reutilizar a store pública atual para evidências sensíveis.

### 3.4 Arquitetura de arquivos recomendada

| Classe | Store | Leitura | Retenção |
|---|---|---|---|
| Imagem pública de catálogo | Pública, se realmente pública | CDN direta | Enquanto o item estiver vigente, com limpeza de órfãos |
| Foto de recebimento | Privada | URL assinada curta após autorização | Política formal |
| Termo, nota e anexo | Privada | Download autenticado e auditado | Política formal/contratual |
| Documento de pessoa | Privada e segregada | Permissão específica, mínimo privilégio | LGPD e política documental |
| Exportação/backup | Repositório de backup separado e criptografado | Operação restrita | Janela definida no runbook |

Requisitos mínimos:

1. autorização antes de emitir URL;
2. URL temporária e específica por objeto;
3. validação real de MIME, extensão e tamanho;
4. inspeção antimalware para documentos;
5. hash e metadados de proveniência;
6. trilha de leitura/download para documentos sensíveis;
7. política de retenção e exclusão;
8. remoção de órfãos após transações abortadas;
9. nenhuma credencial de store exposta ao navegador;
10. store e Functions em região aprovada; São Paulo (`gru1`) existe como opção, mas a decisão de residência deve ser formal.

## 4. Limites atuais dos planos gratuitos

### 4.1 Vercel Hobby

Fontes oficiais atuais: [plano Hobby](https://vercel.com/docs/plans/hobby), [limites](https://vercel.com/docs/limits), [preços](https://vercel.com/pricing) e [termos](https://vercel.com/legal/terms).

| Recurso | Hobby incluído |
|---|---:|
| Projetos | 200 |
| Deployments | 100/dia |
| Build | 6.000 min |
| Builds concorrentes | 1 |
| Active CPU | 4 CPU-h |
| Memória provisionada | 360 GB-h |
| Invocações de Functions | 1.000.000 |
| Function Duration | 100 GB-h |
| Edge Requests | 1.000.000 |
| Fast Data Transfer | 100 GB |
| Imagens-fonte otimizadas | 1.000 |
| Runtime logs | 1 hora, até 4.000 linhas |

No Hobby não há compra de excedente. Ao atingir diversas cotas, o recurso pausa até a janela resetar ou o plano ser atualizado. Os termos também reservam à Vercel o direito de desabilitar deployments Hobby, inclusive sem aviso.

O plano é descrito como pessoal/não comercial. Uma aplicação governamental interna é não comercial, mas também é uso profissional e institucional; não cabe declarar conformidade contratual apenas por interpretação técnica. Jurídico/procurement deve validar o enquadramento. A recomendação operacional continua sendo Pro, destinado pela própria Vercel a profissionais e equipes.

Há ainda uma questão de dados: os [termos atuais](https://vercel.com/legal/terms) dizem que, em Hobby ou trial Pro, conteúdo pode ser usado para treinamento de modelos e compartilhado com terceiros para essa finalidade; também descrevem opção de opt-out nas configurações. Antes de qualquer dado público-setorial real, é obrigatório confirmar documentalmente o opt-out e sua abrangência. Em Pro pago, treinamento não vem habilitado por padrão.

### 4.2 Vercel Blob no Hobby

Fonte oficial: [uso e preços do Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing).

| Recurso | Incluído |
|---|---:|
| Armazenamento médio | 1 GB-mês |
| Operações simples | 10.000 |
| Operações avançadas | 2.000 |
| Transferência Blob | 10 GB |
| Rate limit simples | 1.200/min |
| Rate limit avançado | 900/min |

O uso é medido por média ao longo do mês. Downloads de Blob privado passam por autenticação e podem também consumir Function e Fast Data Transfer. Se a cota Hobby for excedida, o Blob fica inacessível até a janela resetar ou ocorrer upgrade.

### 4.3 Neon Free — aplicável somente se o provedor for confirmado

Fontes oficiais atuais: [preços](https://neon.com/pricing), [planos](https://neon.com/docs/introduction/plans), [transferência](https://neon.com/docs/introduction/network-transfer) e [checklist de produção](https://neon.com/docs/get-started/production-checklist).

| Recurso | Free por projeto |
|---|---:|
| Projetos | até 100 por organização |
| Compute | 100 CU-h/mês por projeto |
| Tamanho máximo de compute | 2 CU / 8 GB RAM |
| Armazenamento | 0,5 GB por projeto |
| Saída pública | 5 GB/mês |
| Scale-to-zero | obrigatório após 5 min |
| Restauração temporal | 6 horas |
| Snapshot manual | 1 |
| Monitoring | 1 dia |
| Suporte | comunidade |
| SLA | nenhum |

Ao esgotar CU-h ou 5 GB de saída, o compute Free é suspenso até o próximo ciclo ou upgrade. O fornecedor posiciona Free para protótipos, side projects e experimentos; Scale é o plano com SLA e controles como IP Allow/private networking.

Um projeto novo recebe sua própria cota de 100 CU-h e 0,5 GB. Portanto, se a conta Neon ainda tiver espaço, separar os dois sistemas em projetos distintos evita compartilhar banco, credenciais, branches, restauração e limites do mesmo projeto.

## 5. A conta atual comporta mais uma aplicação?

### 5.1 Capacidade de deploy: sim, tecnicamente

O time Vercel tem 2 de até 200 projetos e apenas 25 deployments recentes, todos concluídos. Uma segunda aplicação pequena não ameaça limites de projetos, deploy diário ou build. A maior limitação prática é haver apenas um build concorrente; deployments simultâneos entram em fila.

Não foi possível obter o consolidado oficial de CPU, memória, invocações e transferência da equipe Hobby. Assim, a folga nesses quatro itens é **provável**, não certificada. Deve-se abrir Usage → Last 30 days e registrar os valores antes de homologação.

### 5.2 Capacidade do Blob: sim para o início, não para retenção indefinida

A store atual usa somente 15,3 MB. Os cenários abaixo mostram o crescimento do novo sistema, sem contar os objetos atuais:

| Cenário de evidências | Crescimento | Tempo aproximado para consumir 1 GB |
|---|---:|---:|
| 50 arquivos/mês a 300 KB | 180 MB/ano | 5,5 anos |
| 100 arquivos/mês a 500 KB | 600 MB/ano | 20 meses |
| 100 arquivos/mês a 2 MB | 2,4 GB/ano | 5 meses |
| 300 arquivos/mês a 2 MB | 7,2 GB/ano | menos de 2 meses |

São cenários, não previsões. A planilha não informa quantidade de fotos/anexos por recebimento. O resultado demonstra que compressão, limite por arquivo, quantidade de evidências e retenção mudam completamente a viabilidade do gratuito.

Para cinco anos de retenção, até o cenário enxuto de 50 imagens/mês a 300 KB chega a aproximadamente 900 MB. Logo, o gratuito é suficiente para catálogo e piloto, mas não deve ser prometido como solução de longo prazo antes da política documental.

### 5.3 Capacidade do banco: provável para piloto, não certificada para produção

Metadados relacionais ocupam muito menos que imagens. Um cenário de 5.000 linhas de recebimento por ano com custo lógico médio de 5 KB por linha, já incluindo uma aproximação de índices e auditoria, produziria cerca de 25 MB/ano e 125 MB em cinco anos. Com payloads JSON, trilhas detalhadas e 20 KB por linha, o mesmo cenário chegaria a 500 MB e encostaria no limite Free.

Essa conta é uma projeção arquitetural. O schema final, índices, volume de auditoria, histórico importado e crescimento real ainda não existem. Arquivos nunca devem ser armazenados como binário no PostgreSQL.

Se o compute mínimo de 0,25 CU ficar ativo durante 8 horas em 22 dias úteis, o consumo teórico é 44 CU-h/mês, dentro das 100 CU-h. Se ficar ativo continuamente, consome cerca de 180 CU-h/mês e excede Free. Como o scale-to-zero é obrigatório, um sistema interno intermitente tende a caber, com cold starts após períodos ociosos.

### 5.4 Saída do banco: provável folga, com um ponto de atenção

Consultas paginadas e respostas pequenas dificilmente chegam a 5 GB/mês. Relatórios que retornam conjuntos completos, polling frequente, dashboards sem cache ou backups externos excessivos podem atingir a cota. Excedê-la suspende o compute Free.

### 5.5 Veredito de capacidade

| Pergunta | Resposta |
|---|---|
| Cabe criar outro projeto Vercel? | Sim. |
| Cabe outro Blob store? | Sim; Hobby admite várias stores e a atual está quase vazia. |
| O Blob grátis sustenta o piloto? | Sim, com compressão e limites. |
| Sustenta anos de evidências? | Não é possível garantir; em cenários normais pode exceder em meses ou poucos anos. |
| Neon Free comporta o banco inicial? | Provavelmente sim, se confirmado e em projeto separado. |
| Neon Free garante produção sólida? | Não: não há SLA, backup agendado do plano, suporte operacional ou continuidade após exceder cotas. |
| A conta atual está pronta para propriedade institucional? | Não: único owner e identidades pessoais. |
| É seguro reutilizar o Blob público para documentos? | Não. |

## 6. Arquitetura alvo recomendada

```text
GitHub institucional
        |
        v
Vercel Team institucional (Pro)
  - projeto producao
  - projeto preview/homologacao
  - MFA + 2 owners + viewers
  - Functions na regiao aprovada
        |
        +---- PostgreSQL gerenciado
        |       - projeto separado por sistema
        |       - migrations
        |       - pooled URL para runtime
        |       - direct URL somente para migrations
        |       - backups + testes de restauracao
        |
        +---- Blob publico
        |       - somente catalogo realmente publico
        |
        +---- Blob privado
                - fotos, termos, notas, assinaturas, documentos
                - URLs assinadas curtas
                - autorizacao e auditoria
```

### Separações obrigatórias

- um projeto Vercel para cada aplicação;
- um projeto/banco PostgreSQL por aplicação;
- produção separada de preview/homologação;
- store pública separada da privada;
- credenciais diferentes por ambiente;
- migrations com conexão direta e runtime com pool;
- backup fora da mesma conta/provedor, quando a política exigir independência;
- nenhuma cópia de produção em notebook sem procedimento formal.

### Região

Hoje Functions e Blob estão em `iad1`; a região real do banco é desconhecida. O novo desenho deve colocar Functions, banco e Blob próximos para reduzir latência e saída, mas somente depois de decidir residência de dados. `gru1` — São Paulo — é oferecida para Blob; disponibilidade e implicações dos demais serviços devem ser validadas no momento da criação.

## 7. Continuidade, backup e observabilidade

### 7.1 Backup

O plano Neon Free oferece 6 horas de restauração e um snapshot manual; backups agendados são recurso de plano pago. Para homologação com dados importantes, no mínimo:

1. `pg_dump` criptografado em agenda definida;
2. retenção diária/semanal/mensal;
3. cópia fora do mesmo projeto e, idealmente, da mesma conta;
4. teste periódico de restore em banco vazio;
5. registro de RPO e RTO;
6. monitoramento do egress gerado pelo backup.

Backup que nunca foi restaurado é apenas uma hipótese.

### 7.2 Observabilidade

Hobby retém runtime logs por 1 hora; Neon Free, métricas por 1 dia. Isso é insuficiente para investigar incidentes descobertos dias depois e para auditoria operacional. A aplicação deve possuir:

- logs estruturados sem CPF, segredo ou conteúdo documental;
- correlação por requisição e operação;
- trilha de domínio no banco;
- health check sem vazar dependências;
- alerta de erro, quota e backup;
- monitoramento de tamanho do banco, CU-h, egress, Blob GB-mês e operações;
- runbook de indisponibilidade e excedente de quota.

## 8. Titularidade e governança das contas

Antes de produção, corrigir:

1. organização GitHub pertencente ao órgão/equipe, não a um usuário pessoal;
2. Vercel Team institucional com no mínimo dois Owners;
3. e-mail de cobrança e recuperação institucional;
4. MFA obrigatório e recuperação documentada;
5. Neon Organization institucional com pelo menos dois administradores;
6. cartão/faturamento, se houver, aprovado e monitorado;
7. inventário de subprocessadores, DPA, termos e opt-out de treinamento;
8. processo de entrada/saída de membros;
9. secrets rotacionados após transferências;
10. responsável por custo, segurança, backup e incidente identificado por função.

Criar outro projeto na mesma conta pessoal aumenta capacidade, mas também aumenta o raio de impacto da mesma credencial. Não resolve governança.

## 9. Custos de referência

Preços em USD, sem impostos, câmbio ou contratação pública:

| Componente | Referência atual | Observação |
|---|---:|---|
| Vercel Hobby | US$ 0 | Sem excedente pago, sem SLA, pessoal/não comercial. |
| Vercel Pro | US$ 20/mês | Inclui US$ 20 de crédito de infraestrutura; excedente sob demanda. |
| Neon Free | US$ 0 | Protótipos; sem SLA; limites rígidos. |
| Neon Launch | Uso; gasto típico US$ 15/mês | Compute US$ 0,106/CU-h e storage US$ 0,35/GB-mês; sem SLA formal. |
| Neon Scale | Gasto típico US$ 701/mês no exemplo oficial | SLA, controles avançados, segurança/compliance adicionais. |

Para uma aplicação interna leve, uma referência operacional inicial é **US$ 20 da Vercel + poucos dólares a cerca de US$ 15 do Neon Launch**, não necessariamente US$ 35 fixos. O consumo precisa ser medido em piloto. Se SLA formal for requisito, os planos mínimos mudam substancialmente e exigem cotação.

## 10. Plano de ação sem desperdício

### Agora, antes de criar o novo repositório

1. entrar no console Neon e confirmar organização, plano, projetos, região, storage, CU-h e egress;
2. registrar screenshot/export de Usage dos últimos 30 dias na Vercel;
3. decidir se dados reais podem passar por Hobby e confirmar opt-out de treinamento;
4. definir responsável institucional e dois administradores;
5. aprovar classificação de dados e política de retenção.

### Fundação do novo sistema

1. criar projeto Vercel separado;
2. criar projeto PostgreSQL separado;
3. criar store privada separada e, se necessário, store pública de catálogo;
4. escolher região após decisão de residência;
5. usar migrations desde o primeiro deploy;
6. implementar URLs assinadas e autorização;
7. limitar e comprimir uploads;
8. ativar alertas de quota;
9. criar backup e testar restore;
10. executar piloto com métricas reais por 30 a 60 dias.

### Gate para produção

Produção só deve ser aprovada quando houver evidência de:

- titularidade institucional;
- dois administradores e MFA;
- enquadramento contratual/LGPD;
- banco/provedor e região confirmados;
- Blob privado para dados não públicos;
- backup restaurado com sucesso;
- consumo máximo e projeção de 12/36/60 meses;
- alertas de cota e orçamento;
- RPO/RTO aceitos;
- plano de upgrade sem indisponibilidade;
- logs e trilhas suficientes para incidente e auditoria.

## 11. Lacunas que permanecem abertas

| Lacuna | Por que não foi fechada | Como fechar |
|---|---|---|
| Provedor real da `DATABASE_URL` | A variável Vercel é sensível e irrecuperável; não há vínculo de integração | Abrir o console do banco ou identificar o host no inventário institucional. |
| Plano e uso Neon | Não há credencial/CLI Neon acessível nesta sessão | Console Neon → Billing/Projects/Monitoring. |
| Uso consolidado Vercel | `vercel usage` retorna 404 na equipe Hobby | Dashboard Usage → Last 30 days e export/screenshot. |
| Volume futuro de arquivos | Processo ainda não define evidências por recebimento | Piloto e política de retenção. |
| Dados que podem ser públicos | Classificação da informação ainda não foi aprovada | Fiscalização + encarregado LGPD/segurança. |
| SLA/RPO/RTO exigidos | Não constam na planilha nem no briefing | Decisão de governança antes da contratação. |

Essas lacunas não impedem a decisão arquitetural. Elas impedem apenas prometer que o gratuito atual já está certificado para produção.

## 12. Parecer final

1. **Não há banco local em produção.** O `localhost:5433` é desenvolvimento; produção usa uma conexão externa secreta.
2. **Neon é provável, mas não comprovado.** Não usar o nome do provedor em documentação operacional até confirmar a conta viva.
3. **A Vercel atual tem capacidade técnica para outro projeto pequeno.** O uso observado de deploy e Blob é baixo.
4. **O gargalo não é capacidade hoje.** É propriedade pessoal, ausência de SLA, limites rígidos, observabilidade curta e armazenamento público.
5. **A store atual não deve receber dados sensíveis.** Criar uma store privada nova e separar catálogo público de evidência privada.
6. **Free é adequado para descoberta e piloto controlado.** Não é base suficiente para afirmar solidez institucional por anos.
7. **Produção deve ter orçamento de saída do grátis.** Vercel Pro + Neon Launch é o piso operacional razoável para uma carga leve; SLA formal requer planos superiores.
8. **A próxima verificação decisiva é o console Neon.** Sem ela, o estudo pode projetar capacidade, mas não certificar a folga da conta de banco atualmente usada.
