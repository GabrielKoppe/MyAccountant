# Spec 34 — Insights Automáticos do Dashboard

> Status: approved
> Insumo: docs/wave-2.md §3 (Insights automáticos) · revisão de código em `src/components/dashboards/MonthlyDashboardClient.tsx` e `src/lib/queries/budgets.ts`
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`testing`](../skills/testing/SKILL.md) · [`dashboard-widgets`](../skills/dashboard-widgets/SKILL.md)

---

## 1. Problema

O dashboard mensal apresenta apenas **dados brutos visualizados** (KPIs, heatmap, treemap, Sankey, pizzas, tabela de maiores transações). Toda a interpretação — "gastei mais que de costume?", "essa categoria é nova?", "vou estourar uma meta?" — fica por conta do usuário, que precisa cruzar gráficos mentalmente. Não há nenhuma camada narrativa que destaque o que mudou ou o que merece atenção.

- **INS-01**: Em `src/components/dashboards/MonthlyDashboardClient.tsx:190+`, não existe nenhum bloco que **detecte anomalias de gasto** (ex.: categoria muito acima da média recente). Um aumento de 40% em "Alimentação" só é perceptível comparando o treemap/pizza do mês com os meses anteriores manualmente.
- **INS-02**: Não há sinalização de **categorias novas** — uma categoria que começou a ser usada neste mês (zero nos meses anteriores) passa despercebida no meio das demais.
- **INS-03**: O spec 25 (Metas de Orçamento) já calcula progresso por meta (`getBudgetsWithProgress` em `src/lib/queries/budgets.ts:140`), mas só exibe **barras estáticas**. Não há um alerta proativo do tipo "você está em 85% da meta de Alimentação e ainda faltam 9 dias no mês".
- **INS-04**: Não há reforço positivo de **aderência ao orçamento** — quando o usuário fica dentro de uma meta por vários meses seguidos, isso não é reconhecido em lugar nenhum.
- **INS-05**: Mesmo que as regras acima existissem, **não há um componente de UI** padronizado para apresentá-las como cards textuais priorizados no dashboard.

---

## 2. Solução

Introduzir um **motor de insights determinístico** (sem IA): um service que recebe `(accountId, monthId, { isCurrentMonth })` e devolve uma lista priorizada de objetos `Insight`, cada um gerado por uma **função de regra pura e testável**. O resultado é entregue ao dashboard via um **widget `insights`** integrado ao sistema de widgets do spec 33.

Cada regra é uma função independente; o service apenas orquestra, ordena por severidade e aplica o limite. Os cálculos reusam os mesmos conceitos de despesa já usados no app (seções `subtract`, `amountCents > 0`) e o progresso de metas já calculado pelo spec 25.

### 2.1 Motor e regras (INS-01 a INS-04)

- **INS-01 — Pico de gasto por categoria**: para cada categoria, compara a despesa do mês atual com a **média das despesas dessa categoria nos 3 meses anteriores com dados**. "Mês com dados" = mês criado no app que tem pelo menos 1 transação naquela categoria (meses criados sem transações nessa categoria são ignorados, não contam como zero). Gera insight `warning` quando `atual ≥ média × 1.25`, `média > 0` e a variação absoluta for relevante (≥ R$ 50 para evitar ruído de valores pequenos).
- **INS-02 — Categoria nova**: categoria com despesa `> 0` neste mês e despesa `= 0` em **cada um** dos 3 meses anteriores com dados. Gera insight `info`. Dentro de `info`, ordena por valor absoluto gasto na categoria neste mês, decrescente.
- **INS-03 — Risco de estouro de meta**: a partir de `getBudgetsWithProgress`, para metas com `percent ≥ 70` e `percent < 100`, gera insight `warning`. Para o **mês atual** (`isCurrentMonth: true`), inclui o percentual e os **dias restantes do mês fiscal** (respeitando `account_settings.month_start_day`). Para **meses históricos** (`isCurrentMonth: false`), usa texto retrospectivo ("atingiu X% da meta neste mês") sem mencionar dias restantes.
- **INS-04 — Aderência sustentada**: meta que ficou dentro do limite (`percent < 100`) no mês atual **e** nos 2 meses anteriores em que ela existia, totalizando **no mínimo 3 meses consecutivos com histórico disponível**. Se a meta tiver menos de 3 meses de existência, o insight não é gerado. Meses em que a meta não existia são simplesmente ignorados (não contam nem como dentro nem como fora do limite).

### 2.2 Apresentação (INS-05)

- O `InsightsCard` é implementado como **widget do sistema do spec 33**, integrado ao `WIDGET_REGISTRY` nos contextos `monthly` e `month_summary`.
- O widget tem `kind: "panel"`, `span: "full"`, `defaultVisible: false` (opt-in, consistente com a regra do spec 33 para widgets adicionados após o lançamento). O ícone no editor de widgets é `TipsAndUpdatesIcon`.
- Quando ativo, o widget renderiza a lista vertical de insights, cada um com ícone + título + corpo e, opcionalmente, um link de ação (ex.: "Ver meta").
- Se a lista de insights estiver vazia, o widget **não renderiza nada** — sem estado vazio dedicado, sem área em branco. O guard de "lista vazia → não renderiza" é preservado independentemente da posição no layout.
- O usuário pode posicionar o widget livremente via editor de layout do spec 33. A posição recomendada ao ativar é o topo da área analítica, mas não há fixação programática — o usuário controla a ordem via drag-and-drop.
- O mesmo widget é usado em `monthly` e `month_summary`; ambos chamam `generateInsights` com os mesmos parâmetros e recebem o mesmo conjunto de regras (INS-01 a INS-04).

---

## 3. User Stories

- Como usuário, quero ver no topo do dashboard um resumo do que mudou neste mês, para entender minha situação sem ter que interpretar todos os gráficos.
- Como usuário, quero ser avisado quando uma categoria saiu muito da média recente, para identificar gastos atípicos rapidamente.
- Como usuário, quero saber quando uma meta está perto do limite e quantos dias ainda faltam no mês, para ajustar meu comportamento a tempo.
- Como usuário, quero reconhecimento quando mantenho uma meta sob controle por meses seguidos, para reforçar o hábito.
- Como usuário, quero poder ativar ou desativar o bloco de insights no meu dashboard, como qualquer outro widget.
- Como desenvolvedor, quero cada regra de insight como uma função pura isolada, para testá-la com casos positivos e negativos sem montar todo o dashboard.

---

## 4. Critérios de Aceitação

### INS-01 — Pico de gasto por categoria

- QUANDO a despesa de uma categoria no mês atual for `≥ 1.25 ×` a média dos 3 meses anteriores com dados, a média for `> 0` e a diferença absoluta for `≥ R$ 50`, O MOTOR DEVE gerar um insight `warning` com a categoria, o percentual de aumento e os valores comparados.
- "Mês anterior com dados" SIGNIFICA mês criado no app que possui ao menos 1 transação naquela categoria — meses criados sem transações na categoria são ignorados.
- QUANDO não houver pelo menos 1 mês anterior com dados para a categoria, O MOTOR NÃO DEVE gerar este insight (evitar falso positivo por falta de histórico).
- QUANDO o aumento for `< 25%` OU a diferença absoluta for `< R$ 50`, O MOTOR NÃO DEVE gerar o insight.

### INS-02 — Categoria nova

- QUANDO uma categoria tiver despesa `> 0` no mês atual e despesa `= 0` em cada um dos 3 meses anteriores com dados, O MOTOR DEVE gerar um insight `info` identificando a categoria.
- SE houver despesa dessa categoria em qualquer um dos 3 meses anteriores com dados, O MOTOR NÃO DEVE classificá-la como nova.
- QUANDO houver múltiplos insights INS-02, DEVEM ser ordenados por valor absoluto gasto na categoria neste mês, decrescente.

### INS-03 — Risco de estouro de meta

- QUANDO uma meta ativa tiver `percent ≥ 70` e `percent < 100`, O MOTOR DEVE gerar um insight `warning` com o rótulo da meta e o percentual atingido.
- SE `isCurrentMonth` for `true`, O INSIGHT DEVE incluir os dias restantes do mês fiscal no corpo da mensagem.
- SE `isCurrentMonth` for `false` (mês histórico), O INSIGHT DEVE usar texto retrospectivo sem mencionar dias restantes (ex.: "atingiu X% da meta neste mês").
- O cálculo de dias restantes DEVE respeitar `account_settings.month_start_day` (mesma regra de "mês atual" usada no resto do app).
- QUANDO a meta já estiver `≥ 100%`, O MOTOR NÃO DEVE gerar este insight (o estouro já é exibido pela barra de progresso do spec 25).

### INS-04 — Aderência sustentada

- QUANDO uma meta ficou com `percent < 100` no mês atual e em cada um dos meses anteriores em que ela existia, totalizando **no mínimo 3 meses** com histórico disponível, O MOTOR DEVE gerar um insight `success` indicando a sequência dentro do limite.
- SE a meta tiver menos de 3 meses de histórico disponível (foi criada recentemente), O MOTOR NÃO DEVE gerar o insight.
- Meses em que a meta não existia são ignorados — não contam como dentro nem fora do limite.
- SE a meta estourar em qualquer um dos meses em que existe, O MOTOR NÃO DEVE gerar o insight.

### Orquestração e priorização

- O MOTOR DEVE retornar **no máximo 5 insights**, priorizando severidade `warning` > `success` > `info`; dentro da mesma severidade, ordenar por relevância (maior variação/percentual primeiro; para `info`, por valor absoluto decrescente).
- Toda query do motor DEVE filtrar por `accountId` (multi-tenancy).
- O resultado DEVE ser cacheado por `(accountId, monthId)` via `unstable_cache` com TTL de 5 min e tag `account:${accountId}`, invalidado via `revalidateTag("account:" + accountId)` nas mutações de transações e metas.

### INS-05 — Apresentação (widget)

- O widget `insights` DEVE estar registrado em `WIDGET_REGISTRY` nos contextos `monthly` e `month_summary` com `kind: "panel"`, `span: "full"`, `defaultVisible: false`.
- QUANDO o widget estiver ativo e houver ao menos 1 insight, O WIDGET DEVE renderizar a lista de insights com ícone, título e corpo por insight.
- QUANDO um insight tiver `action`, O CARD DEVE renderizar um link/botão navegando para o `href` informado.
- QUANDO a lista de insights for vazia, O WIDGET NÃO DEVE renderizar nada (sem área em branco, sem estado vazio).
- A severidade DEVE mapear para tokens semânticos (`warning.subtle` / `success.subtle` / cor neutra para `info`), validados em light **e** dark mode — nunca cores hardcoded.

---

## 5. Fora de Escopo

- **Insights com IA / linguagem natural gerada por LLM** — todas as regras são determinísticas e puras.
- **"3 maiores transações do mês" como insight** — já coberto pela tabela `TopTransactionTable` existente no dashboard; duplicar seria redundante.
- **Insights no dashboard anual** — apenas nos contextos `monthly` e `month_summary` nesta spec.
- **Configuração de regras pelo usuário** (ligar/desligar regras, ajustar thresholds) — thresholds são fixos em código nesta versão.
- **Persistência/histórico de insights** (marcar como lido, dispensar) — gerados sob demanda a cada carregamento, sem estado em banco.
- **Notificações push/email** a partir de insights — pode integrar futuramente com o spec 29.
- **Insight de variação para baixo** ("gastou X% menos") — apenas picos de alta nesta versão.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Geração | Sob demanda no carregamento do dashboard, sem job/cron | Volume pequeno por mês; `unstable_cache` cobre custo. |
| Cache | `unstable_cache` por `(accountId, monthId)`, TTL 5 min, tag `account:${accountId}` | Evita recomputar a cada navegação; invalida por tag em mutações. |
| Invalidação de cache | `revalidateTag("account:" + accountId)` adicionado às actions de transação e meta | Actions de transação já têm `revalidatePath` broad; actions de meta precisam adicionar invalidação do dashboard (atualmente só invalidam a página de settings). |
| Estrutura das regras | Uma função pura por regra, sem acesso a Prisma | Testável isoladamente (positivos/negativos), conforme `skills/testing`. |
| Janela de comparação INS-01 | 3 meses anteriores **com dados** (mês criado + ≥ 1 transação na categoria) | Evita falsos positivos por meses vazios; equilíbrio entre estabilidade e relevância. |
| Threshold de pico | `≥ 25%` **e** `≥ R$ 50` absolutos | O piso absoluto evita ruído em categorias de valor baixo. |
| INS-04 mínimo de meses | 3 meses de histórico disponível (ignora meses sem a meta) | Evita parabenizar cedo demais; meses sem a meta são ignorados, não contam como falha. |
| INS-03 mês histórico | Texto retrospectivo ("atingiu X% da meta") sem dias restantes | Preserva utilidade do insight ao navegar em meses passados, sem informação sem sentido. |
| isCurrentMonth | Parâmetro `{ isCurrentMonth: boolean }` passado pela RSC page | A page já conhece o mês (URL params) e as settings; evita query redundante dentro do service. |
| Integração de UI | Widget `insights` no `WIDGET_REGISTRY` (contextos `monthly` e `month_summary`) | Reutiliza o sistema de ordenação/visibilidade do spec 33; usuário controla posição via drag-and-drop. |
| defaultVisible | `false` | Consistente com a regra do spec 33 para widgets adicionados após o lançamento; feature opt-in. |
| Ícone do widget | `TipsAndUpdatesIcon` | Ícone oficial MUI para insights automatizados; visualmente distinto de todos os outros widgets do registry. |
| Ordenação INS-02 | Por valor absoluto gasto na categoria, decrescente | Coloca a categoria nova mais relevante (maior impacto financeiro) no topo. |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar / criar |
|---|---|
| INS-01..04 | `src/server/services/insights-service.ts` (orquestrador + regras puras) + `.test.ts` (1 bloco por regra + multi-tenancy) |
| Dados | `src/lib/queries/insights.ts` (agregações por categoria/mês reusando `groupBy`, e leitura de `getBudgetsWithProgress` adaptada para `monthId` arbitrário) |
| Cache | wrapper `unstable_cache` no service (tag `account:${accountId}`) |
| INS-03 dias restantes | reusar helper de mês fiscal (`account_settings.month_start_day`) — ver `skills/date-timezone` |
| INS-05 | `src/components/dashboards/InsightsCard.tsx` (lista de cards com mapa inline de ícones) |
| INS-05 widget | `src/components/dashboards/widget-registry.ts` — adicionar `insights` em `monthly` e `month_summary` |
| INS-05 ícone | `src/components/settings/widget-icons.tsx` — mapear `"insights"` → `TipsAndUpdatesIcon` |
| INS-05 integração monthly | `src/components/dashboards/MonthlyDashboardClient.tsx` (adicionar `"insights"` ao `nodeMap`) e `src/app/(app)/[accountId]/dashboards/monthly/[monthId]/page.tsx` (chamar o service, detectar `isCurrentMonth`, passar dados) |
| INS-05 integração month_summary | `src/components/months/MonthSummary.tsx` (adicionar `"insights"` ao `nodeMap`) e RSC page correspondente |
| Cache invalidação | `src/actions/budgets.ts` — adicionar `revalidateTag("account:" + ctx.accountId)` (atualmente só invalida a página de settings) |
| Mensagens | `src/lib/messages/pt-BR.ts` sob `dashboards.insights.*` (todos os textos e templates, incluindo variantes prospectiva e retrospectiva de INS-03) e `dashboards.widgets.monthly.insights` / `month_summary.insights` + `dashboards.widgets.descriptions.monthly["insights"]` |

### 7.1 Tipo `Insight` e contrato do service

```ts
// src/server/services/insights-service.ts
export type InsightSeverity = "info" | "warning" | "success";

export type Insight = {
  id: string;                 // estável por (regra + dimensão), ex: "spike:catId"
  severity: InsightSeverity;
  icon: string;               // chave de ícone MUI resolvida em InsightsCard (não JSX no service)
  title: string;              // já localizado via m.dashboards.insights.*
  body: string;
  action?: { label: string; href: string };
};

// Orquestrador: roda cada regra, concatena, ordena por severidade e corta em 5.
// isCurrentMonth: true = mês em andamento (inclui dias restantes em INS-03)
//                 false = mês histórico (usa texto retrospectivo em INS-03)
export async function generateInsights(
  accountId: string,
  monthId: string,
  options: { isCurrentMonth: boolean },
): Promise<Insight[]>;
```

### 7.2 Regra como função pura (exemplo INS-01)

```ts
// ✅ Correto — função pura, sem Prisma, recebe dados já agregados
const SPIKE_RATIO = 1.25;
const SPIKE_MIN_DELTA = 5000n; // R$ 50,00 em centavos

export function detectCategorySpikes(input: {
  current: Map<string, { name: string; cents: bigint }>;     // categoria → gasto do mês
  prior: Map<string, bigint[]>;                              // categoria → gastos dos meses anteriores COM DADOS
}): Insight[] {
  const out: Insight[] = [];
  for (const [catId, { name, cents }] of input.current) {
    const history = input.prior.get(catId) ?? [];
    if (history.length === 0) continue;                       // sem histórico → não inferir
    const avg = history.reduce((a, b) => a + b, 0n) / BigInt(history.length);
    if (avg <= 0n) continue;
    const delta = cents - avg;
    if (delta < SPIKE_MIN_DELTA) continue;                    // piso absoluto
    if (cents * 100n < avg * BigInt(Math.round(SPIKE_RATIO * 100))) continue; // < +25%
    const pct = Number((delta * 100n) / avg);
    out.push({
      id: `spike:${catId}`,
      severity: "warning",
      icon: "TrendingUp",
      title: m.dashboards.insights.spikeTitle(name),
      body: m.dashboards.insights.spikeBody(pct, formatCentsToBrl(cents), formatCentsToBrl(avg)),
    });
  }
  return out;
}

// ❌ Anti-padrão — regra que consulta o banco e formata JSX
// async function detectSpikes(accountId) { const rows = await prisma...; return <Card/> }
```

### 7.3 Ícones individuais por regra

Os ícones dos insights individuais são resolvidos inline em `InsightsCard.tsx` via mapa estático — não precisa de arquivo separado pois são apenas 4 entradas:

```ts
// Dentro de InsightsCard.tsx (não exportado)
const INSIGHT_ICON_MAP = {
  TrendingUp: TrendingUpIcon,   // INS-01 pico
  FiberNew: FiberNewIcon,        // INS-02 nova categoria
  Warning: WarningAmberIcon,     // INS-03 risco de estouro
  EmojiEvents: EmojiEventsIcon,  // INS-04 aderência sustentada
};
```

### 7.4 Definição de despesa (consistência com o app)

> Despesa por categoria = soma de `amountCents` de transações em seções `countType = "subtract"`, com `amountCents > 0` e `table.countInMonth = true` — mesma base já usada em `calcSpent` (`src/lib/queries/budgets.ts:184`) e na §7.2 do spec 11. Agregar com `groupBy({ by: ["categoryId"] })` por mês, nunca N+1.

### 7.5 Detecção de `isCurrentMonth` na RSC page

```ts
// src/app/(app)/[accountId]/dashboards/monthly/[monthId]/page.tsx

// A page já carrega account settings para outros fins (ex: monthStartDay para o heatmap).
// Reusar para detectar se o mês sendo visualizado é o mês fiscal atual.
import { getCurrentMonth } from "@/lib/dates";

const settings = await getAccountSettings(accountId); // já carregado
const month = await getMonth(monthId);                 // já carregado
const current = getCurrentMonth(new Date(), settings.monthStartDay);
const isCurrentMonth = month.year === current.year && month.month === current.month;

const insights = await generateInsights(accountId, monthId, { isCurrentMonth });
```
