# Spec 34 — Insights Automáticos do Dashboard

> Status: draft
> Insumo: docs/wave-2.md §3 (Insights automáticos) · revisão de código em `src/components/dashboards/MonthlyDashboardClient.tsx` e `src/lib/queries/budgets.ts`
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

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

Introduzir um **motor de insights determinístico** (sem IA): um service que recebe `(accountId, monthId)` e devolve uma lista priorizada de objetos `Insight`, cada um gerado por uma **função de regra pura e testável**. O dashboard mensal exibe esses insights em um bloco de cards textuais no topo da área analítica.

Cada regra é uma função independente; o service apenas orquestra, ordena por severidade e aplica o limite. Os cálculos reusam os mesmos conceitos de despesa já usados no app (seções `subtract`, `amountCents > 0`) e o progresso de metas já calculado pelo spec 25.

### 2.1 Motor e regras (INS-01 a INS-04)

- **INS-01 — Pico de gasto por categoria**: para cada categoria, compara a despesa do mês atual com a **média das despesas dessa categoria nos 3 meses anteriores com dados**. Gera insight `warning` quando `atual ≥ média × 1.25`, `média > 0` e a variação absoluta for relevante (≥ R$ 50 para evitar ruído de valores pequenos).
- **INS-02 — Categoria nova**: categoria com despesa `> 0` neste mês e despesa `= 0` em **cada um** dos 3 meses anteriores. Gera insight `info`.
- **INS-03 — Risco de estouro de meta**: a partir de `getBudgetsWithProgress`, para metas com `percent ≥ 70` e `percent < 100`, gera insight `warning` incluindo o percentual e os **dias restantes do mês fiscal** (respeitando `account_settings.month_start_day`).
- **INS-04 — Aderência sustentada**: meta que ficou dentro do limite (`percent < 100`) no mês atual **e** nos 2 meses anteriores (3 meses seguidos) gera insight `success`.

### 2.2 Apresentação (INS-05)

- Novo componente `InsightsCard` renderiza a lista vertical de insights no dashboard mensal, cada um com ícone + título + corpo e, opcionalmente, um link de ação (ex.: "Ver meta").
- O bloco aparece **no topo** da área analítica do mensal (acima do heatmap/treemap). Se a lista estiver vazia, o bloco **não é renderizado** (sem estado vazio dedicado).
- Integração com o sistema de widgets do spec 33: quando o registry de widgets existir, o bloco entra como widget `insights` no contexto `monthly` (ver §6 D4).

---

## 3. User Stories

- Como usuário, quero ver no topo do dashboard um resumo do que mudou neste mês, para entender minha situação sem ter que interpretar todos os gráficos.
- Como usuário, quero ser avisado quando uma categoria saiu muito da média recente, para identificar gastos atípicos rapidamente.
- Como usuário, quero saber quando uma meta está perto do limite e quantos dias ainda faltam no mês, para ajustar meu comportamento a tempo.
- Como usuário, quero reconhecimento quando mantenho uma meta sob controle por meses seguidos, para reforçar o hábito.
- Como desenvolvedor, quero cada regra de insight como uma função pura isolada, para testá-la com casos positivos e negativos sem montar todo o dashboard.

---

## 4. Critérios de Aceitação

### INS-01 — Pico de gasto por categoria

- QUANDO a despesa de uma categoria no mês atual for `≥ 1.25 ×` a média dos 3 meses anteriores com dados, a média for `> 0` e a diferença absoluta for `≥ R$ 50`, O MOTOR DEVE gerar um insight `warning` com a categoria, o percentual de aumento e os valores comparados.
- QUANDO não houver pelo menos 1 mês anterior com dados para a categoria, O MOTOR NÃO DEVE gerar este insight (evitar falso positivo por falta de histórico).
- QUANDO o aumento for `< 25%` OU a diferença absoluta for `< R$ 50`, O MOTOR NÃO DEVE gerar o insight.

### INS-02 — Categoria nova

- QUANDO uma categoria tiver despesa `> 0` no mês atual e despesa `= 0` em cada um dos 3 meses anteriores, O MOTOR DEVE gerar um insight `info` identificando a categoria.
- SE houver despesa dessa categoria em qualquer um dos 3 meses anteriores, O MOTOR NÃO DEVE classificá-la como nova.

### INS-03 — Risco de estouro de meta

- QUANDO uma meta ativa tiver `percent ≥ 70` e `percent < 100`, O MOTOR DEVE gerar um insight `warning` com o rótulo da meta, o percentual atingido e os dias restantes do mês fiscal.
- O cálculo de dias restantes DEVE respeitar `account_settings.month_start_day` (mesma regra de "mês atual" usada no resto do app).
- QUANDO a meta já estiver `≥ 100%`, O MOTOR NÃO DEVE gerar este insight (o estouro já é exibido pela barra de progresso do spec 25).

### INS-04 — Aderência sustentada

- QUANDO uma meta ficar com `percent < 100` no mês atual e em cada um dos 2 meses anteriores, O MOTOR DEVE gerar um insight `success` indicando a sequência de 3 meses dentro do limite.
- SE a meta não existir/estourar em algum dos 3 meses, O MOTOR NÃO DEVE gerar o insight.

### Orquestração e priorização

- O MOTOR DEVE retornar **no máximo 5 insights**, priorizando severidade `warning` > `success` > `info`; dentro da mesma severidade, ordenar por relevância (maior variação/percentual primeiro).
- Toda query do motor DEVE filtrar por `accountId` (multi-tenancy).
- O resultado DEVE ser cacheado por `(accountId, monthId)` via `unstable_cache` com TTL de 5 min e tag `account:${accountId}`, invalidado nas mutações de transações/metas.

### INS-05 — Apresentação

- QUANDO houver ao menos 1 insight, O DASHBOARD MENSAL DEVE exibir o bloco `InsightsCard` no topo da área analítica, com ícone, título e corpo por insight.
- QUANDO um insight tiver `action`, O CARD DEVE renderizar um link/botão navegando para o `href` informado.
- QUANDO a lista de insights for vazia, O BLOCO NÃO DEVE ser renderizado.
- A severidade DEVE mapear para tokens semânticos (`warning.subtle` / `success.subtle` / cor neutra para `info`), validados em light **e** dark mode — nunca cores hardcoded.

---

## 5. Fora de Escopo

- **Insights com IA / linguagem natural gerada por LLM** — todas as regras são determinísticas e puras.
- **"3 maiores transações do mês" como insight** — já coberto pela tabela `TopTransactionTable` existente no dashboard; duplicar seria redundante.
- **Insights no dashboard anual ou no resumo do mês** — apenas no contexto `monthly` nesta spec.
- **Configuração de regras pelo usuário** (ligar/desligar regras, ajustar thresholds) — thresholds são fixos em código nesta versão.
- **Persistência/histórico de insights** (marcar como lido, dispensar) — gerados sob demanda a cada carregamento, sem estado em banco.
- **Notificações push/email** a partir de insights — pode integrar futuramente com o spec 29.
- **Insight de variação para baixo** ("gastou X% menos") — apenas picos de alta nesta versão.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Geração | Sob demanda no carregamento do dashboard, sem job/cron | Volume pequeno por mês; `unstable_cache` cobre custo. |
| Cache | `unstable_cache` por `(accountId, monthId)`, TTL 5 min | Evita recomputar a cada navegação; invalida por tag em mutações. |
| Estrutura das regras | Uma função pura por regra, sem acesso a Prisma | Testável isoladamente (positivos/negativos), conforme `skills/testing`. |
| Janela de comparação | 3 meses anteriores **com dados** | Equilíbrio entre estabilidade e relevância; meses inexistentes são ignorados, não contam como zero. |
| Threshold de pico | `≥ 25%` **e** `≥ R$ 50` absolutos | O piso absoluto evita ruído em categorias de valor baixo. |
| Integração de UI | Widget `insights` no registry do spec 33 (contexto `monthly`) | Reusa ordenação/visibilidade do spec 33; ver D4. |

> **D4 — dependência do spec 33**: o spec 33 (Widgets Configuráveis) ainda é `draft`. Se for implementado **antes** desta spec, basta registrar o widget `insights` no `WIDGET_REGISTRY.monthly` (kind `panel`, span `full`, posição no topo) e fornecer o nó. Se esta spec for implementada **antes** do spec 33, o `InsightsCard` é renderizado diretamente no topo do `MonthlyDashboardClient`, e o spec 33 deverá incluí-lo no catálogo ao ser implementado. Em ambos os casos o guard "lista vazia → não renderiza" é preservado.

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar / criar |
|---|---|
| INS-01..04 | `src/server/services/insights-service.ts` (orquestrador + regras puras) + `.test.ts` (1 bloco por regra + multi-tenancy) |
| Dados | `src/lib/queries/insights.ts` (agregações por categoria/mês reusando `groupBy`, e leitura de `getBudgetsWithProgress` por mês) |
| Cache | wrapper `unstable_cache` no service (tag `account:${accountId}`) |
| INS-03 dias restantes | reusar helper de mês fiscal (`account_settings.month_start_day`) — ver `skills/date-timezone` |
| INS-05 | `src/components/dashboards/InsightsCard.tsx` (lista de cards) |
| INS-05 integração | `src/components/dashboards/MonthlyDashboardClient.tsx` (renderizar no topo) e `src/app/(app)/[accountId]/dashboards/monthly/[monthId]/page.tsx` (chamar o service) |
| Spec 33 | `src/components/dashboards/widget-registry.ts` (registrar widget `insights` quando o registry existir) |
| Mensagens | `src/lib/messages/pt-BR.ts` sob `dashboards.insights.*` (todos os textos e templates) |

### 7.1 Tipo `Insight` e contrato do service

```ts
// src/server/services/insights-service.ts
export type InsightSeverity = "info" | "warning" | "success";

export type Insight = {
  id: string;                 // estável por (regra + dimensão), ex: "spike:catId"
  severity: InsightSeverity;
  icon: string;               // chave de ícone MUI resolvida na UI (não JSX no service)
  title: string;              // já localizado via m.dashboards.insights.*
  body: string;
  action?: { label: string; href: string };
};

// Orquestrador: roda cada regra, concatena, ordena por severidade e corta em 5.
export async function generateInsights(
  accountId: string,
  monthId: string,
): Promise<Insight[]>;
```

### 7.2 Regra como função pura (exemplo INS-01)

```ts
// ✅ Correto — função pura, sem Prisma, recebe dados já agregados
const SPIKE_RATIO = 1.25;
const SPIKE_MIN_DELTA = 5000n; // R$ 50,00 em centavos

export function detectCategorySpikes(input: {
  current: Map<string, { name: string; cents: bigint }>;     // categoria → gasto do mês
  prior: Map<string, bigint[]>;                              // categoria → gastos dos meses anteriores com dados
}): Insight[] {
  const out: Insight[] = [];
  for (const [catId, { name, cents }] of input.current) {
    const history = input.prior.get(catId) ?? [];
    if (history.length === 0) continue;                       // ❌ sem histórico → não inferir
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

### 7.3 Definição de despesa (consistência com o app)

> Despesa por categoria = soma de `amountCents` de transações em seções `countType = "subtract"`, com `amountCents > 0` e `table.countInMonth = true` — mesma base já usada em `calcSpent` (`src/lib/queries/budgets.ts:184`) e na §7.2 do spec 11. Agregar com `groupBy({ by: ["categoryId"] })` por mês, nunca N+1.
