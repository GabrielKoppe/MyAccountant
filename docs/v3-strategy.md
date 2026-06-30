# MyAccountant — Avaliação e Projeção Estratégica

> Documento estratégico: levantamento do produto e da arquitetura após 41 specs entregues, cruzado com benchmark de mercado de organizadores financeiros (PFM) 2025–2026, e backlog priorizado de novas specs.
> Baseado em: síntese do corpus de specs (00–41), análise da base de código (~56k LOC), e benchmark de mercado. Data: **2026-06-29**.
> Versão visual (Artifact): publicada em sessão de análise. Specs derivadas: [42–58](../specs/).

---

## TL;DR

O MyAccountant ultrapassou a fase de "app de controle financeiro" e virou uma **plataforma de gestão financeira colaborativa com análise declarativa**. A engenharia está sólida e disciplinada (100% das mutações via `defineAction`, multi-tenancy validado em duas camadas e testado, código limpíssimo). O produto está **pronto para produção**.

A oportunidade agora é menos sobre fundação e mais sobre **profundidade financeira** (net worth, metas, previsão, assinaturas, regras) e sobre transformar o diferencial de **colaboração** num fosso competitivo real (split de despesas, visões compartilhadas, agregação Open Finance via Pluggy). A casa está bem construída e bem testada; falta mobiliá-la com as funções que o mercado já considera básicas — e abrir as portas para o que ninguém mais faz bem: finanças genuinamente colaborativas.

Este documento mapeia o estado atual, avalia a arquitetura, posiciona o produto no mercado e propõe **17 novas specs (42–58)** organizadas em 4 pilares e 4 fases.

---

## 1. Veredito Executivo

### 1.1 Scorecard

| Dimensão | Nota | Status |
|---|---|---|
| Arquitetura em camadas | 9/10 | Excelente — `defineAction` + Services + Queries bem separados |
| Schema & multi-tenancy | 9/10 | Robusto — 28 models, `accountId` em tudo, BigInt para dinheiro |
| Cobertura de testes | 7/10 | Acima da média — services/queries bem cobertos; gaps em UI/E2E |
| Saúde do código | 8/10 | Limpo — strict TS, 1 `console.log`, 2 TODOs em toda a base |
| Performance | 7/10 | Bom — `React.cache()`, mas queries grandes sem paginação |
| Escalabilidade | 7/10 | Pronto para milhares de usuários; risco acima de ~5k transações/mês/Account |

**Veredito: pronto para produção**, com mitigações de dívida técnica recomendadas em paralelo às novas features.

### 1.2 Números do projeto

- **41 specs** entregues (00–41; spec 37 ausente na numeração).
- **~56k linhas** de TS/TSX em `src/`; **28 models** Prisma; **99** arquivos usando `defineAction`/`defineUserAction`.
- **~463 casos de teste** em ~31 arquivos; services e queries cobertos, incluindo testes explícitos de multi-tenancy.
- **20 skills** de padrões reutilizáveis em `skills/`.

---

## 2. Estado Atual do Produto

O domínio é hierárquico e flexível: `Account → Mês → Seção → Tabela → Transação`, com seções configuráveis por regra de contagem (somar / subtrair / ignorar / neutro). Sobre essa base, as 41 specs entregaram:

### 2.1 Transações & dados
- CRUD completo, duplicação, bulk move/delete, edição inline com atualização otimista.
- Busca, filtro e ordenação ([spec 19](../specs/19-transaction-search-filter-sort.md)); undo de exclusão ([spec 41 TRN-08](../specs/41-aprimoramentos-objeto-transacao.md)).
- Import CSV/XLSX com templates e preview ([spec 10](../specs/10-csv-xlsx-import.md)).
- Recorrentes via templates ([spec 24](../specs/24-recurring-transactions.md)); parcelamento estruturado (`InstallmentGroup`/`PendingInstallment`); tags; vínculos de reembolso (`TransactionLink`) — [spec 41](../specs/41-aprimoramentos-objeto-transacao.md).
- Comentários e anexos por transação ([spec 30](../specs/30-comments-attachments.md)).

### 2.2 Análise & dashboards
- Dashboards mensal / anual / resumo com widgets instanciáveis (grid 2D, drag, config) — [specs 33](../specs/33-dashboard-widgets.md)/[36](../specs/36-widgets-configuraveis-instanciaveis.md)/[38](../specs/38-novos-widgets-dashboard.md).
- Sankey, treemap, heatmap, gauge de orçamento.
- Sandbox de análise ad-hoc (dimensão × métrica × gráfico) — [spec 17](../specs/17-sandbox.md).
- Insights automáticos ([spec 34](../specs/34-insights-automaticos.md)); orçamentos com alertas ([spec 25](../specs/25-budget-targets.md)); análise por membro ([spec 35](../specs/35-analise-por-membro.md)).

### 2.3 Colaboração & plataforma
- Multi-tenancy real; papéis owner / editor / viewer; convites por e-mail ([spec 04](../specs/04-accounts-and-members.md)).
- Múltiplas Accounts por usuário ([spec 31](../specs/31-multiple-accounts.md)).
- Notificações in-app de eventos colaborativos ([spec 29](../specs/29-notifications.md)).
- Onboarding guiado ([spec 26](../specs/26-guided-onboarding.md)); export CSV/PDF ([spec 22](../specs/22-data-export.md)); PWA mobile ([spec 28](../specs/28-mobile-pwa.md)); API REST + OpenAPI/Swagger ([spec 14](../specs/14-api-and-swagger.md)).

---

## 3. Avaliação de Arquitetura

A separação `UI → Action → Service → Prisma` é seguida com rigor incomum: **100%** das mutações passam por `defineAction`/`ActionResult`, com checagem de papel e validação Zod. Multi-tenancy é validado em duas camadas (action + service) e explicitamente testado. O código é limpo — apenas 1 `console.log` e 2 TODOs em toda a base. A dívida técnica existe, mas está concentrada e mapeada.

### 3.1 Riscos técnicos rankeados

| # | Risco | Localização | Severidade |
|---|---|---|---|
| 01 | **Queries grandes sem paginação** — carrega todas as transações do mês em memória; subqueries múltiplas. OK abaixo de ~5k transações/mês, degrada acima. | `src/server/queries/month-page.ts` (ex.: `:347-389`, `:186-199`) · `dashboards.ts` (~1173 linhas) | 🔴 Crítico · escala |
| 02 | **Tipagem fraca em widgets** — config dinâmica apoiada em tipos abertos (`renderMode: string`, `configSchema: z.ZodTypeAny`, `config: z.unknown()`); erros só em runtime. ~361 `any` no projeto, concentrados na área de widgets/layout. | `src/components/dashboards/_core/widget-registry.ts:33,57-58` · `dashboard-layout.ts:20` | 🟡 Médio · manutenção |
| 03 | **Componentes de transação grandes e duplicados** — lógica de validação/formatação repetida; cada nova feature multiplica o esforço. | `TransactionRowEditor.tsx` (840) · `TransactionTable.tsx` (690) · `TransactionRow.tsx` (579) · `NewTransactionRow.tsx` (539) | 🟡 Médio · manutenção |
| 04 | **Ausência de testes E2E** — services bem cobertos, mas nenhum fluxo ponta-a-ponta; regressões de integração passam despercebidas. Sem Playwright no projeto. | `tests/` | 🟢 Baixo · qualidade |

Esses riscos viram as specs [56](../specs/56-paginacao-escala-queries.md), [57](../specs/57-tipagem-widgets-refator-transacao.md) e [58](../specs/58-testes-e2e.md).

---

## 4. Benchmark de Mercado (PFM 2025–2026)

O fim do **Mint** (mar/2024, ~25M usuários órfãos) e do **Guiabolso** (nov/2022, comprado pelo PicPay) deixou milhões sem casa e validou o modelo pago/sem-ads. **Monarch** e **Copilot** capturaram o topo com agregação automática, IA conversacional e net worth. No Brasil, o **Open Finance** (regulado pelo BACEN, +100M de clientes, obrigatório desde jan/2025) torna a agregação automática viável e regulada, via agregadores como **Pluggy** e **Belvo**.

### 4.1 Players e features distintivas

| App | Proposta de valor | Feature distintiva |
|---|---|---|
| **YNAB** | Orçamento zero-based; mudança de comportamento | "Age of Money"; YNAB Together (até 6 pessoas) |
| **Monarch Money** | Sucessor do Mint; households + net worth | **Shared Views** (meu/dele/nosso); AI Assistant; colaboração ilimitada |
| **Copilot Money** | App premium iOS/Mac; IA de categorização | Review estilo "swipe"; enrichment de merchant |
| **Rocket Money** | Achar e cancelar assinaturas | Detecção de assinaturas + negociação de contas |
| **PocketGuard** | "Quanto posso gastar?" | "In My Pocket"; plano de dívida snowball/avalanche |
| **Lunch Money** | PFM indie, multi-moeda, API-first | 160+ moedas com câmbio histórico; API pública |
| **Actual Budget** | Open source, self-hosted | Local-first; **usa Pluggy.ai para bancos BR** |
| **Firefly III** | Open source self-hosted | Motor de regras if-then potente |
| **Organizze / Mobills** (BR) | Controle financeiro simples / completo | Fatura de cartão como entidade de 1ª classe; Open Finance em planos pagos |

> Apps de finanças de casal estão **consolidando, não inovando**: Zeta foi descontinuado (mai/2025, comprado pela Acorns) e Tandem adquirido (nov/2025).

### 4.2 Tendências que viraram expectativa-padrão

1. **Agregação bancária automática** (Plaid/Pluggy) — table-stakes; entrada manual é vista como legado.
2. **IA conversacional** sobre dados reais — Monarch e Copilot já lançaram.
3. **Household / shared finance** — vocabulário "meu / dele / nosso", atribuição de transações a membros.
4. **Net worth** (ativos − passivos) ao longo do tempo — tela "hero" de todo app premium.
5. **Cashflow forecasting** — Monarch cobra à parte.
6. **Subscription tracking** — negócio inteiro do Rocket Money.

### 4.3 Lacunas do MyAccountant frente ao mercado

| Capacidade | Quem faz | MyAccountant | Vira spec |
|---|---|---|---|
| Agregação bancária (Open Finance/Pluggy) | Todos os premium | ❌ | [52](../specs/52-agregacao-open-finance-pluggy.md) |
| Split de despesas entre pessoas | Splitwise, Honeydue | ❌ | [42](../specs/42-divisao-despesas-membros.md) |
| Patrimônio líquido (net worth) | Monarch, Copilot | ❌ | [46](../specs/46-patrimonio-liquido.md) |
| Metas de poupança (goals) | YNAB, Monarch | ❌ | [47](../specs/47-metas-poupanca.md) |
| Previsão de fluxo de caixa | Monarch Plus | base pronta | [48](../specs/48-previsao-fluxo-caixa.md) |
| Rastreamento de assinaturas | Rocket Money | base pronta | [49](../specs/49-rastreamento-assinaturas.md) |
| Regras de auto-categorização | Firefly, Copilot | parcial | [50](../specs/50-regras-auto-categorizacao.md) |
| Fatura de cartão (ciclo) | Organizze, Mobills | parcial | [53](../specs/53-ciclo-fatura-cartao.md) |
| Gestão de dívidas (snowball/avalanche) | YNAB, PocketGuard | ❌ | [51](../specs/51-gestao-dividas.md) |
| Visões compartilhadas (perspectiva) | Monarch | ❌ | [43](../specs/43-visoes-compartilhadas.md) |
| Assistente de IA | Monarch, Copilot | ❌ | [55](../specs/55-assistente-ia-conversacional.md) |

---

## 5. Projeção Estratégica

### 5.1 O fosso é a colaboração — e quase ninguém o defende bem

O MyAccountant já tem o que Monarch/Honeydue/Zeta vendem como premium: **múltiplos membros com papéis reais**. E vai além do casal: famílias, repúblicas, sócios, e até o contador como _viewer_. Enquanto o mercado de finanças de casal consolida, há espaço para um produto colaborativo de verdade.

**Posicionamento-alvo:** _"O organizador financeiro colaborativo do Brasil — agregação automática via Open Finance, com split de despesas e orçamento compartilhado que nenhum app une bem."_

### 5.2 Duas direções para os próximos 12 meses

- **Profundidade financeira** — net worth, goals, forecast, assinaturas e regras transformam o app de "registro" em "gestão". A maioria reaproveita estrutura já existente (recorrentes, insights, tags), então são **wins relativamente baratos**.
- **Moat de colaboração + agregação** — Shared Views, split estilo Splitwise e agregação Open Finance posicionam o produto em território que nenhum concorrente domina no Brasil. São as apostas caras, mas de maior retorno estratégico. Validação: o Actual Budget **já usa Pluggy** para bancos brasileiros, provando a viabilidade técnica.

---

## 6. Backlog de Novas Specs (42–58)

17 specs candidatas, organizadas por pilar. Todas criadas em `Status: draft` em [`specs/`](../specs/).

### Pilar A — Moat de colaboração
- [**42** — Divisão de Despesas entre Membros](../specs/42-divisao-despesas-membros.md): split (igual/%/valor/cotas) + saldo "quem deve a quem" + acerto de contas, reusando `TransactionLink`. _Splitwise não tem orçamento; o MyAccountant uniria os dois._
- [**43** — Visões Compartilhadas (Por Membro)](../specs/43-visoes-compartilhadas.md): rótulo de propriedade + filtro de perspectiva em dashboards/listas. _Feature mais elogiada do Monarch; alavanca a estrutura seção→tabela._
- [**44** — Privacidade Granular e Papel Contador](../specs/44-privacidade-granular-contador.md): visibilidade por seção/membro + papel `accountant`. _Diferencial do Honeydue; abre caso de uso com contador._
- [**45** — Feed de Atividade e Menções](../specs/45-feed-atividade-mencoes.md): timeline consolidada + @menções. _Estende comentários/notificações já existentes._

### Pilar B — Profundidade financeira
- [**46** — Patrimônio Líquido (Net Worth)](../specs/46-patrimonio-liquido.md): contas de ativo/passivo + evolução temporal. _Tela "hero" de todo app premium._
- [**47** — Metas de Poupança](../specs/47-metas-poupanca.md): metas com alvo/prazo + metas conjuntas por membro. _Versão colaborativa diferencia de YNAB/Monarch._
- [**48** — Previsão de Fluxo de Caixa](../specs/48-previsao-fluxo-caixa.md): projeção de saldo a partir de recorrentes + parcelas. _Monarch cobra à parte._
- [**49** — Rastreamento de Assinaturas](../specs/49-rastreamento-assinaturas.md): detecção + alerta de reajuste. _Win barato sobre recorrentes; negócio do Rocket Money._
- [**50** — Motor de Regras de Auto-categorização](../specs/50-regras-auto-categorizacao.md): if-then no import e em novas transações. _Firefly/Monarch oferecem; potencializa o import CSV._
- [**51** — Gestão de Dívidas](../specs/51-gestao-dividas.md): snowball/avalanche + timeline. _Complementa o orçamento com plano de saída._

### Pilar C — Brasil & agregação
- [**52** — Agregação Bancária via Open Finance](../specs/52-agregacao-open-finance-pluggy.md): conexão automática via Pluggy. _Maior lacuna competitiva; regulada e viável no BR. Aposta-âncora._
- [**53** — Ciclo de Fatura de Cartão de Crédito](../specs/53-ciclo-fatura-cartao.md): fatura como entidade (≠ mês-calendário), integrando o parcelamento existente. _Organizze/Mobills tratam fatura como 1ª classe._
- [**54** — Relatório de Imposto de Renda](../specs/54-relatorio-imposto-renda.md): consolidação anual + export p/ contador. _Dor anual real no Brasil; conecta ao papel-contador (44)._

### Pilar D — Inteligência & fundação técnica
- [**55** — Assistente de IA Conversacional](../specs/55-assistente-ia-conversacional.md): chat sobre os dados da Account via tool-use (Claude), multi-tenancy estrito. _Tendência nº 1 de 2025-26._
- [**56** — Paginação e Escala de Queries](../specs/56-paginacao-escala-queries.md): paginação + divisão da query de dashboards + telemetria. _Endereça o Risco nº 1._
- [**57** — Tipagem de Widgets e Refator de Transação](../specs/57-tipagem-widgets-refator-transacao.md): union discriminada nos widgets + extração de `useTransactionEditor`. _Reduz Riscos 2 e 3._
- [**58** — Testes End-to-End](../specs/58-testes-e2e.md): Playwright para 5–10 fluxos críticos. _Único gap relevante de testes._

---

## 7. Roadmap Sugerido (V3)

A regra de ouro do projeto — "não comece a próxima fase sem fechar a anterior" — aplicada ao backlog.

| Fase | Tema | Specs | Racional |
|---|---|---|---|
| **V3.0** | Fundação + wins baratos | [56](../specs/56-paginacao-escala-queries.md), [57](../specs/57-tipagem-widgets-refator-transacao.md), [49](../specs/49-rastreamento-assinaturas.md), [45](../specs/45-feed-atividade-mencoes.md), [43](../specs/43-visoes-compartilhadas.md) | Habilitar escala e colher valor reaproveitando o que existe |
| **V3.1** | Profundidade financeira | [46](../specs/46-patrimonio-liquido.md), [47](../specs/47-metas-poupanca.md), [48](../specs/48-previsao-fluxo-caixa.md), [50](../specs/50-regras-auto-categorizacao.md) | De "registro" para "gestão"; igualar os líderes em função |
| **V3.2** | Moat colaborativo | [42](../specs/42-divisao-despesas-membros.md), [44](../specs/44-privacidade-granular-contador.md), [58](../specs/58-testes-e2e.md) | Defender o diferencial; E2E cobre os fluxos colaborativos |
| **V3.3** | Apostas Brasil + IA | [52](../specs/52-agregacao-open-finance-pluggy.md), [53](../specs/53-ciclo-fatura-cartao.md), [54](../specs/54-relatorio-imposto-renda.md), [55](../specs/55-assistente-ia-conversacional.md) | Saltar à frente do mercado local, com fundação já firme |

> [51](../specs/51-gestao-dividas.md) (dívidas) e multi-moeda (campo já no schema) ficam como faixa oportunista, encaixáveis conforme demanda.

---

## 8. Fontes do Benchmark

- **Mint (fim):** [Bloomberg](https://www.bloomberg.com/news/articles/2023-11-01/intuit-winds-down-personal-finance-app-mint-shifts-users-to-credit-karma) · [Monarch](https://www.monarch.com/blog/mint-shutting-down)
- **Guiabolso / Olivia (BR, descontinuados):** [Seu Dinheiro](https://www.seudinheiro.com/2022/empresas/app-guiabolso-sera-encerrado-apos-conclusao-da-integracao-com-o-picpay-em-novembro-julw/) · [Finsiders](https://finsidersbrasil.com.br/noticias-sobre-fintechs/olivia-comprada-pelo-nubank-vai-encerrar-app-no-mes-que-vem/)
- **Open Finance Brasil:** [Finsiders — 100M clientes](https://finsidersbrasil.com.br/economia-open/brasil-lidera-open-finance-no-mundo-com-100-milhoes-de-clientes/) · [Mattos Filho — novas regras](https://www.mattosfilho.com.br/unico/novas-regras-open-finance/)
- **Pix Automático:** [Agência Brasil](https://agenciabrasil.ebc.com.br/economia/noticia/2025-06/banco-central-anuncia-o-pix-automatico)
- **Pluggy / Belvo:** [Pluggy](https://www.pluggy.ai/en) · [Belvo](https://belvo.com/)
- **Monarch (Shared Views / AI):** [Shared Views](https://www.monarch.com/blog/shared-views) · [AI Features](https://help.monarch.com/hc/en-us/articles/16116906962452-About-Monarch-s-AI-Features)
- **Splitwise (split / settle up):** [Helpdesk](https://feedback.splitwise.com/knowledgebase/articles/1088920-how-do-i-use-splitwise)
- **Actual Budget usa Pluggy (BR):** [Bank Sync docs](https://actualbudget.org/docs/advanced/bank-sync/)
- **Zeta / Tandem (consolidação):** [Acorns–Zeta](https://www.acorns.com/learn/acorns-zeta-acquisition/) · [Reseda–Tandem](https://www.prnewswire.com/news-releases/reseda-group-acquires-tandem-finance-app-to-extend-expense-sharing-solution-to-modern-families-302612298.html)

> Nota de método: datas de descontinuação (Mint, Guiabolso, Zeta), fases/datas do Open Finance e Pix Automático, e features de colaboração/IA do Monarch foram verificadas em fontes primárias. Preços de apps mudam com frequência — confirmar antes de fechar qualquer spec.
