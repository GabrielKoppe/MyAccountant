# Spec 38 — Novos Widgets de Dashboard

> Status: implemented (ActivityWidget, FilteredTransactionsWidget, WeeklySpendingWidget, TopCategoriesWidget, CategoryBreakdownWidget, InstitutionBreakdownWidget, MemberListWidget, ChecklistWidget, KpiCustomWidget e outros — 2026-07-11)
> Insumo: conversa de produto (2026-06-11) sobre expansão do catálogo de widgets da Spec 33; refinamento de produto (2026-06-21)
> Relacionado: [`spec 41`](41-aprimoramentos-objeto-transacao.md) (widget `recurring-vs-variable` aguarda `isFixed` nesta spec)
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

A Spec 33 criou o sistema de widgets e migrou os blocos que já existiam hardcoded — mas limitou o catálogo aos widgets pré-existentes. Campos já presentes no schema e queries já implementadas sustentariam visualizações de alto valor que hoje não existem.

- **FEAT-01**: O widget `budgets` (`widget-registry.ts:26`) exibe o progresso de cada meta como uma barra horizontal num painel de largura total. Não existe um indicador consolidado de "saúde geral" das metas — o usuário precisa escanear todas as barras individualmente para ter uma leitura rápida do orçamento como um todo.

- **FEAT-02**: O dashboard anual (`yearly`) não tem nenhum widget de *breakdown* por membro — apenas o `member-trend` (gráfico de linhas com evolução mês a mês). Não é possível ver, no anual, um ranking consolidado de "quem gastou mais no ano inteiro" de forma direta. Nota: `member-breakdown` no contexto `monthly` já está implementado — este FEAT cobre apenas o contexto `yearly`.

- **FEAT-03**: `Transaction.institutionId` (`prisma/schema.prisma`) está disponível em todas as transações, porém só aparece como dimensão de filtro nas metas (Spec 25). Não há widget que mostre a distribuição de gastos por banco ou plataforma.

- **FEAT-04**: O widget `daily-heatmap` mostra intensidade por dia, mas não agrega por semana. Não há visão de "em qual semana do mês gastei mais" — recorte útil para quem recebe salário, boleto ou benefício em datas fixas dentro do mês.

- **FEAT-05**: Não há KPI de volume de transações em nenhum dos três contextos (`monthly`, `yearly`, `month_summary`). Meses com volume atipicamente alto ou baixo são sinais de comportamento incomum, mas esse dado não está surfaceado.

---

## 2. Solução

Adicionar novos widgets ao registry — todos com `defaultVisible: false` para não alterar layouts existentes. Cada widget reutiliza dados já disponíveis sem novas migrações de banco.

### 2.1 FEAT-01 — Gauge de saúde das metas

Novo widget `kpi-budget-health` (`kind: "kpi"`, contexto `monthly`).

Exibe o percentual médio de utilização de todas as metas ativas do mês como um **gauge semicircular** (recharts `PieChart` com `startAngle=180, endAngle=0`). A cor muda conforme o percentual: verde (`success.main`) abaixo de 70%, amarelo (`warning.main`) entre 70–90%, vermelho (`danger.main`) acima de 90%.

**Variantes de tamanho (`KPI_VARIANTS`):**
- `default` (1×1): percentual numérico centralizado com cor semântica + pequeno arco de fundo indicativo. Sem label — a cor comunica o status.
- `wide` (2×1): semicírculo completo com percentual no centro e label "Saúde do Orçamento" acima.

Reutiliza `getBudgetsWithProgress` de `src/lib/queries/budgets.ts:140` — os dados já são carregados pela página do dashboard mensal para o widget `budgets`. Não há nova query.

Se não houver metas ativas no mês, o widget exibe estado vazio padrão (sem renderizar o gauge).

### 2.2 FEAT-02 — Breakdown por membro no anual

Novo widget **`member-yearly`** (`kind: "panel"`, contexto `yearly`).

Exibe o ranking consolidado de gastos por membro ao longo do ano inteiro (total acumulado), complementando o `member-trend` (que mostra evolução mês a mês). Reutiliza os componentes `MemberBreakdownWidget` e `MemberListWidget` já existentes no contexto `monthly` — a diferença é apenas na query de dados (agrega o ano em vez do mês).

**Variantes de tamanho:**
- `compact` (2×2): top-3 membros em lista compacta com valor total — reutiliza `MemberListWidget` com `renderMode: "compact"`.
- `default` (3×3): gráfico de barras/pizza com top-5 membros e percentuais — reutiliza `MemberBreakdownWidget` com `renderMode: "default"`.
- `large` (4×3): gráfico + ranking detalhado com percentual e categoria principal de cada membro — reutiliza `MemberListWidget` com `renderMode: "full"`.

Nova função `getMemberYearlyBreakdown(accountId, year)` em `src/lib/queries/member-analytics.ts`, seguindo o mesmo padrão de `getMemberMonthlyBreakdown` (multi-tenancy via `accountId`, `amountCents > 0`, seções `countType: subtract`, tabelas `countInMonth: true`). Truncar ao top-5 membros se houver muitos.

### 2.3 FEAT-03 — Breakdown por instituição

Novo widget **`institution-breakdown`** (`kind: "panel"`, contexto `monthly`).

Gráfico donut (recharts `PieChart`) com distribuição de saídas por instituição. Considera apenas `institutionId` (FK para `Institution`) — transações com `institutionText` preenchido mas sem `institutionId` são agrupadas em "Sem instituição", sem grupo separado. Considera apenas saídas (`amountCents > 0`) em tabelas com `countInMonth = true`. Cores via `getChartColors(mode)`.

**Variantes de tamanho:**
- `compact` (2×2): donut sem legenda; apenas cores como informação e percentual da maior fatia em overlay.
- `default` (3×3): donut com legenda lateral listando instituições, valores absolutos e percentuais.
- `large` (4×4): donut com legenda + lista ordenada de todas as instituições com valores e percentuais.

Nova função `getInstitutionBreakdown(accountId, monthId)` em `src/lib/queries/dashboards.ts`.

### 2.4 FEAT-04 — Gastos por semana

Novo widget **`week-chart`** (`kind: "panel"`, contexto `monthly`).

Gráfico de barras verticais (recharts `BarChart`) com 4–6 colunas, cada uma representando uma semana do período do mês. As semanas são calculadas a partir de `account_settings.month_start_day` (ver `skills/date-timezone/SKILL.md`). Semanas parciais no início e fim do mês são incluídas.

**Variantes de tamanho:**
- `compact` (2×1): mini-barras sem rótulos nem valores numéricos — sinal rápido da semana de maior gasto pela forma visual.
- `default` (3×2): barras com label de semana ("Sem 1", "Sem 2" etc.); valor exibido em hover/tooltip.
- `large` (4×3): barras com valores explícitos acima de cada barra + linha de referência com a média semanal do mês.

**Configuração interna (`configSchema`):** o usuário escolhe a métrica exibida:
- `expense` (padrão): apenas saídas (`amountCents > 0`, seções `countType = subtract`, tabelas `countInMonth = true`) — consistente com o `daily-heatmap`.
- `income`: apenas entradas (`amountCents > 0`, seções `countType = add`, tabelas `countInMonth = true`).
- `both`: barras agrupadas por semana mostrando despesas e receitas lado a lado.

Nova função `getWeeklySpending(accountId, monthId, monthStartDay, metric)` em `src/lib/queries/dashboards.ts`.

### 2.5 FEAT-05 — Contagem de transações

Novo KPI **`kpi-transaction-count`** (`kind: "kpi"`, `sizeVariants: KPI_VARIANTS`) adicionado a três contextos: `monthly`, `yearly`, `month_summary`.

**Padrão (sem config):** conta todas as transações do período sem nenhum filtro adicional — número bruto de lançamentos.

**Configuração interna (`configSchema`):** o usuário pode refinar o escopo via painel de config:
```typescript
const transactionCountConfigSchema = z.object({
  countInMonth: z.enum(["all", "only"]).default("all"),
  // "all" = sem filtro; "only" = apenas tabelas com countInMonth = true
  sectionType: z.enum(["all", "subtract", "add"]).default("all"),
  // "all" = sem filtro; "subtract" = só despesas; "add" = só receitas
  includePending: z.boolean().default(true),
  // false = excluir transações com isPending = true
});
```

Pode ser derivado adicionando um campo `transactionCount` nas queries de dados já carregadas pelo RSC da página — não exige nova query dedicada.

### 2.6 FEAT-06 — kpi-pending em month_summary

Adicionar o widget já existente **`kpi-pending`** ao contexto `month_summary` com `defaultVisible: false`. Não requer nenhum componente novo — o `KpiSparklineCard` já utilizado em `monthly` e `yearly` é reutilizado diretamente. Os dados de pendentes do mês já são carregados pelo RSC da página de resumo.

---

## 3. User Stories

- Como usuário que define metas de orçamento, quero um indicador visual único de saúde do orçamento, para saber em um relance se estou dentro ou acima dos limites sem escanear cada barra individualmente.
- Como usuário de uma conta compartilhada (casal, família), quero ver no dashboard anual quem gastou mais ao longo do ano inteiro, para ter uma visão consolidada além da evolução mês a mês.
- Como usuário, quero saber qual semana do mês concentra meus maiores gastos, para ajustar o comportamento nas semanas seguintes.
- Como usuário, quero poder adicionar o widget de gastos por instituição no meu dashboard mensal, para entender quais canais de pagamento uso mais.
- Como usuário, quero saber quantas transações lancei no mês, com a opção de filtrar por tipo ou excluir pendentes, para ter uma noção de volume de registros.
- Como usuário, quero ver no resumo do mês quantas transações estão pendentes, para não esquecer de confirmá-las.

---

## 4. Critérios de Aceitação

**FEAT-01 — kpi-budget-health:**
- QUANDO `kpi-budget-health` está ativo e há metas cadastradas no mês, O WIDGET DEVE exibir um gauge semicircular recharts com o percentual médio de utilização das metas.
- SE o percentual médio for < 70%, O ARCO DO GAUGE DEVE ter cor `success.main`.
- SE o percentual médio for entre 70% e 90% (inclusive), O ARCO DEVE ter cor `warning.main`.
- SE o percentual médio for > 90%, O ARCO DEVE ter cor `danger.main`.
- SE não houver metas ativas no mês, O WIDGET DEVE exibir o estado vazio padrão em vez do gauge.
- O widget NÃO DEVE causar nova query além das já carregadas pela página do dashboard mensal.

**FEAT-02 — member-yearly:**
- QUANDO `member-yearly` está ativo, O WIDGET DEVE exibir apenas membros com pelo menos uma transação de saída no ano.
- QUANDO há transações sem responsável, ELAS DEVEM aparecer agrupadas como "Sem responsável" (não omitidas silenciosamente).
- O widget NÃO DEVE incluir transações de tabelas com `countInMonth = false` ou seções `countType != subtract`.
- O widget NÃO DEVE vazar dados de outras Accounts (filtro por `accountId` obrigatório).
- O componente DEVE reutilizar `MemberBreakdownWidget` ou `MemberListWidget` (já existentes no contexto `monthly`), parametrizados com os dados anuais.
- QUANDO um membro não tem nome, O WIDGET DEVE exibir seu email como fallback.

**FEAT-03 — institution-breakdown:**
- QUANDO `institution-breakdown` está ativo, O DONUT DEVE agrupar apenas saídas (`amountCents > 0`) em tabelas com `countInMonth = true`.
- O WIDGET DEVE considerar apenas `institutionId` (FK cadastrada); transações com `institutionText` preenchido mas sem `institutionId` NÃO DEVEM criar grupo separado — são agrupadas em "Sem instituição".
- QUANDO transações não têm `institutionId`, ELAS DEVEM aparecer agrupadas como "Sem instituição" (não omitidas silenciosamente).
- As fatias DEVEM usar `getChartColors(mode)` para cor, não hexadecimais hardcoded.
- NA variante `compact` (2×2), O DONUT DEVE ser exibido sem legenda; apenas cor e percentual da maior fatia em overlay.
- NA variante `large` (4×4), O WIDGET DEVE exibir donut + lista ordenada com todas as instituições, valores absolutos e percentuais.

**FEAT-04 — week-chart:**
- QUANDO `week-chart` está ativo, AS SEMANAS DEVEM ser calculadas a partir de `account_settings.month_start_day`, não a partir do dia 1 do mês calendário.
- O GRÁFICO DEVE exibir entre 4 e 6 barras dependendo do número de semanas no período do mês.
- Semanas parciais no início ou fim do período DEVEM ser incluídas, não descartadas.
- QUANDO `config.metric = "expense"`, O WIDGET DEVE exibir apenas saídas (`countType = subtract`); `"income"` apenas entradas (`countType = add`); `"both"` barras agrupadas com despesas e receitas lado a lado.
- NA variante `compact` (2×1), O WIDGET DEVE exibir mini-barras sem rótulos nem valores numéricos — apenas a forma visual.
- NA variante `large` (4×3), O WIDGET DEVE exibir valores explícitos acima de cada barra e uma linha de referência com a média semanal do mês.

**FEAT-05 — kpi-transaction-count:**
- QUANDO `kpi-transaction-count` está ativo, O KPI DEVE exibir por padrão a contagem de **todas** as transações do período, sem nenhum filtro aplicado.
- QUANDO `config.countInMonth = "only"`, O KPI DEVE contar apenas transações em tabelas com `countInMonth = true`.
- QUANDO `config.sectionType = "subtract"`, O KPI DEVE contar apenas transações em seções `countType = subtract`; `"add"` apenas seções `countType = add`.
- QUANDO `config.includePending = false`, O KPI DEVE excluir transações com `isPending = true`.
- O mesmo widget ID DEVE funcionar nos três contextos (`monthly`, `yearly`, `month_summary`) respeitando o período correspondente.

**FEAT-06 — kpi-pending em month_summary:**
- O widget `kpi-pending` DEVE estar disponível no contexto `month_summary` com `defaultVisible: false`.
- A QUERY usada DEVE ser a mesma já disponível para o RSC da página de resumo do mês, sem nova chamada ao banco.

**Todos os novos widgets:**
- Todos os novos widgets DEVEM ter `defaultVisible: false` no registry — não devem aparecer em dashboards existentes sem ação do usuário.
- Todos os novos widgets DEVEM ter entrada correspondente em `m.dashboards.widgets.[context]` (label) e `m.dashboards.widgets.descriptions.[context]` (descrição curta).
- Todos os novos widgets DEVEM ter ícone mapeado em `src/components/settings/widget-icons.tsx`.
- QUANDO os dados do widget estiverem vazios, O WIDGET DEVE exibir o estado vazio padrão do projeto (sem crash, sem área em branco sem explicação).

---

## 5. Fora de Escopo

- **Projeção de saldo (forecast)**: estimar o saldo ao fim do mês com base em recorrentes futuros — lógica de extrapolação requer spec própria.
- **Gauge com ponteiro animado (agulha)**: a versão com arco preenchido (sem ponteiro) é suficiente para v1. Ponteiro pode ser adicionado na Spec 36 (configuração interna).
- **`budget-gauge-detail` com múltiplos anéis**: um anel por meta — visualmente rico mas poluído com muitas metas. Fica para a Spec 36 como configuração do widget `kpi-budget-health`.
- **Insights automáticos**: detectar anomalias e gerar textos de alerta — coberto pela Spec 34.
- **Análise detalhada por membro ao longo do tempo**: evolução, médias, comparação entre membros — coberto pela Spec 35. Este spec cobre apenas o breakdown básico do mês/ano.
- **Configuração interna dos widgets** (ex.: filtrar por membro específico no `member-breakdown`, top-N no `institution-breakdown`) — coberto pela Spec 36.
- **Widget de aderência anual às metas** (`budget-adherence`): percentual de meses em que as metas foram cumpridas — aguarda Spec 25 ter dados suficientes de histórico.
- **`member-kpi`** (KPI do maior gastador do mês): aguarda Spec 35 para não duplicar a query de agregação por membro.
- **Widget `recurring-vs-variable`** (donut fixo vs variável): depende de `isFixed` no objeto `Transaction`, que ainda não existe no schema. Extraído para [`spec 41`](41-aprimoramentos-objeto-transacao.md) (aprimoramentos do objeto Transaction).
- Dark mode: os widgets DEVEM suportar dark mode usando tokens semânticos e `getChartColors(mode)`, mas testes visuais formais de dark mode ficam fora do escopo desta spec.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Gauge style | Semicírculo recharts (sem ponteiro/agulha) | Ponteiro requer SVG customizado complexo; o arco preenchido transmite a mesma informação com menos código e melhor responsividade |
| Gauge `kind` | `kpi` (KPI_VARIANTS: 1×1 e 2×1) | Espaço de KPI é suficiente para comunicar o status por cor; `panel` seria desperdício de área para uma única métrica |
| Gauge `default` (1×1) | Número + arco de fundo, sem label | Em 1×1 o semicírculo completo seria ilegível; a cor semântica é o sinal principal |
| Gauge `wide` (2×1) | Semicírculo completo + percentual + label | Espaço 2×1 permite o arco completo com leitura clara |
| Gauge métrica | Média simples dos percentuais das metas | `sum(spent) / sum(budget)` favorece metas grandes e distorce a percepção; a média trata cada meta igualmente |
| `kpi-transaction-count` padrão | Todas as transações sem filtro | Contador bruto de lançamentos; filtros são opcionais via configSchema |
| `kpi-transaction-count` configSchema | countInMonth + sectionType + includePending | Os 3 filtros cobrem os recortes mais relevantes sem tornar a config complexa |
| `kpi-pending` em `month_summary` | Adicionado com `defaultVisible: false` | Widget já existente; nenhum componente novo; query já disponível no RSC da página |}
| `responsibleUserId = null` | Agrupar como "Sem responsável" | Omitir silenciosamente esconde uma porção potencialmente grande dos gastos; a transparência é preferível |
| `institutionId = null` | Agrupar como "Sem instituição" | Mesma razão acima |
| Semanas do mês | Baseadas em `month_start_day`, não no calendário gregoriano | Mantém consistência com o restante do app; semana 1 começa sempre no `month_start_day` |
| `defaultVisible` dos novos widgets | `false` para todos | Não alterar layouts existentes de quem já usa o app; o usuário ativa sob demanda nas configurações |
| Truncamento em `member-yearly` | Top-5 membros por total | Contas com muitos membros tornam o gráfico ilegível; top-5 cobre a maioria dos casos reais |
| `institution-breakdown` — `institutionText` | Ignorado; transações sem `institutionId` → "Sem instituição" | Agrupar por texto livre cria categorias inconsistentes (mesmo banco, texto diferente); a instituição formal é o dado estruturado e confiável |
| `week-chart` — métrica configurável | `configSchema: { metric: "expense" \| "income" \| "both" }`, padrão `"expense"` | Padrão alinhado ao `daily-heatmap` (despesas); o usuário pode trocar conforme necessidade via painel de config do editor |
| Filosofia de variantes de tamanho | compact = sinal mínimo; default = análise padrão; large = contexto completo | Documentada em `skills/dashboard-widgets/SKILL.md` §Filosofia de Variantes de Tamanho |
| `recurring-vs-variable` | Extraído para spec 41 | Campo `isFixed` não existe em `Transaction`; adicionar exige decisões de produto (migration, UX, backfill) que têm spec própria |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Registro dos novos widgets | `src/components/dashboards/widget-registry.ts` |
| Labels e descrições | `src/lib/messages/pt-BR.ts` |
| Ícones dos novos widgets | `src/components/settings/widget-icons.tsx` |
| Queries de breakdown por membro e instituição | `src/lib/queries/dashboards.ts` |
| Query semanal | `src/lib/queries/dashboards.ts` |
| Componente `kpi-budget-health` | `src/components/dashboards/kpi/BudgetHealthKpi.tsx` (novo — reutiliza `KpiSparklineCard` com renderMode `default`/`wide`) |
| Componente `member-yearly` | Reutiliza `MemberBreakdownWidget` + `MemberListWidget` de `src/components/dashboards/panels/` |
| Componente `institution-breakdown` | `src/components/dashboards/panels/InstitutionBreakdownWidget.tsx` (novo) |
| Componente `week-chart` | `src/components/dashboards/panels/WeeklySpendingWidget.tsx` (novo) |
| Integração no dashboard mensal | `src/components/dashboards/monthly/MonthlyDashboardClient.tsx` |
| Integração no dashboard anual | `src/components/dashboards/yearly/YearlyDashboardClient.tsx` |
| Integração no resumo do mês | `src/components/dashboards/monthly/MonthSummary.tsx` (add `kpi-pending` e `kpi-transaction-count`) |
| Query `member-yearly` | `src/lib/queries/member-analytics.ts` (`getMemberYearlyBreakdown`) |
| Query `institution-breakdown` | `src/lib/queries/dashboards.ts` (`getInstitutionBreakdown`) |
| Query `week-chart` | `src/lib/queries/dashboards.ts` (`getWeeklySpending`) |

### Entradas no registry (novos WidgetDef)

```typescript
// src/components/dashboards/_core/widget-registry.ts

// Nota: o registry usa o formato da Spec 36 (sizeVariants, sem span).
// Variantes seguem a filosofia compact/default/large — ver skills/dashboard-widgets/SKILL.md.

// Constantes de sizeVariants específicas por widget:
// institution-breakdown: compact 2×2 (donut sem legenda), default 3×3 (donut + legenda), large 4×4 (donut + lista)
const INSTITUTION_BREAKDOWN_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default"  },
  { id: "compact", labelKey: "compact", w: 2, h: 2, renderMode: "compact"  },
  { id: "large",   labelKey: "large",   w: 4, h: 4, renderMode: "expanded" },
];
// week-chart: compact 2×1 (mini-barras), default 3×2 (barras + rótulos), large 4×3 (barras + valores + média)
const WEEK_CHART_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 2, renderMode: "default"  },
  { id: "compact", labelKey: "compact", w: 2, h: 1, renderMode: "compact"  },
  { id: "large",   labelKey: "large",   w: 4, h: 3, renderMode: "expanded" },
];
// member-yearly: compact 2×2 (top-3 lista), default 3×3 (gráfico + top-5), large 4×3 (gráfico + ranking detalhado)
const MEMBER_YEARLY_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default"  },
  { id: "compact", labelKey: "compact", w: 2, h: 2, renderMode: "compact"  },
  { id: "large",   labelKey: "large",   w: 4, h: 3, renderMode: "expanded" },
];

// configSchema do week-chart:
const weekChartConfigSchema = z.object({
  metric: z.enum(["expense", "income", "both"]).default("expense"),
});

// configSchema do kpi-transaction-count:
const transactionCountConfigSchema = z.object({
  countInMonth: z.enum(["all", "only"]).default("all"),
  // "all" = sem filtro; "only" = apenas tabelas com countInMonth = true
  sectionType: z.enum(["all", "subtract", "add"]).default("all"),
  // "all" = sem filtro; "subtract" = só despesas; "add" = só receitas
  includePending: z.boolean().default(true),
  // false = excluir transações com isPending = true
});

// monthly — acrescentar ao array existente:
{ id: "kpi-budget-health",     labelKey: "budgetHealth",        kind: "kpi",   defaultVisible: false, sizeVariants: KPI_VARIANTS },
{ id: "kpi-transaction-count", labelKey: "transactionCount",    kind: "kpi",   defaultVisible: false, sizeVariants: KPI_VARIANTS, configSchema: transactionCountConfigSchema, defaultConfig: { countInMonth: "all", sectionType: "all", includePending: true } },
{ id: "institution-breakdown", labelKey: "institutionBreakdown",kind: "panel", defaultVisible: false, sizeVariants: INSTITUTION_BREAKDOWN_VARIANTS },
{ id: "week-chart",            labelKey: "weekChart",           kind: "panel", defaultVisible: false, sizeVariants: WEEK_CHART_VARIANTS, configSchema: weekChartConfigSchema, defaultConfig: { metric: "expense" } },
// recurring-vs-variable: aguarda spec 41 (isFixed em Transaction)

// yearly — acrescentar ao array existente:
{ id: "kpi-transaction-count", labelKey: "transactionCount",    kind: "kpi",   defaultVisible: false, sizeVariants: KPI_VARIANTS, configSchema: transactionCountConfigSchema, defaultConfig: { countInMonth: "all", sectionType: "all", includePending: true } },
{ id: "member-yearly",         labelKey: "memberYearly",        kind: "panel", defaultVisible: false, sizeVariants: MEMBER_YEARLY_VARIANTS },

// month_summary — acrescentar ao array existente:
{ id: "kpi-pending",           labelKey: "pending",             kind: "kpi",   defaultVisible: false, sizeVariants: KPI_VARIANTS },
{ id: "kpi-transaction-count", labelKey: "transactionCount",    kind: "kpi",   defaultVisible: false, sizeVariants: KPI_VARIANTS, configSchema: transactionCountConfigSchema, defaultConfig: { countInMonth: "all", sectionType: "all", includePending: true } },
```

### Gauge semicircular com recharts

```tsx
// src/components/dashboards/widgets/BudgetHealthGauge.tsx
import { PieChart, Pie, Cell } from "recharts";
import { useTheme } from "@mui/material/styles";

function gaugeColor(percent: number, theme: ReturnType<typeof useTheme>): string {
  if (percent < 70) return theme.palette.success.main;
  if (percent < 90) return theme.palette.warning.main;
  return (theme.palette as Record<string, unknown>).danger?.main as string ?? theme.palette.error.main;
}

export function BudgetHealthGauge({ percent }: { percent: number }) {
  const theme = useTheme();
  const color = gaugeColor(percent, theme);
  const filled = Math.min(Math.max(percent, 0), 100);

  return (
    <PieChart width={160} height={90}>
      <Pie
        data={[{ value: filled }, { value: 100 - filled }]}
        cx={80}
        cy={85}
        startAngle={180}
        endAngle={0}
        innerRadius={50}
        outerRadius={75}
        dataKey="value"
        stroke="none"
        isAnimationActive={false}
      >
        <Cell fill={color} />
        <Cell fill={theme.palette.action.selected} />
      </Pie>
    </PieChart>
  );
}
```

### Query do `member-yearly` (padrão a seguir)

```typescript
// src/lib/queries/member-analytics.ts — nova função
export const getMemberYearlyBreakdown = cache(
  async (accountId: string, year: number): Promise<MemberBreakdownRow[]> => {
    // Agrega todas as transações de despesa de todos os meses do ano:
    // - accountId obrigatório (multi-tenancy)
    // - amountCents > 0
    // - section.countType = "subtract"
    // - table.countInMonth = true
    // Reutilizar resolveResponsibleIdentities para nomes (membros atuais e ex-membros)
    // Retornar no mesmo formato MemberBreakdownRow (compatível com MemberBreakdownWidget/MemberListWidget)
    // Truncar ao top-5 por totalCents DESC
  }
);
```

### Cálculo de semana do mês

```typescript
// Semana baseada em month_start_day — não no calendário gregoriano
function weekOfMonth(occurredOn: Date, monthStartDay: number): number {
  // monthStartDay: dia em que o mês "começa" (ex: 5 → mês começa no dia 5)
  // Calcula diferença em dias entre occurredOn e o início do mês do período
  // Divide por 7 e arredonda para baixo — resultado: 1, 2, 3, 4 (ou 5)
}
```

### Reutilização do BudgetProgress

```typescript
// getBudgetsWithProgress já existe em src/lib/queries/budgets.ts:140
// Para kpi-budget-health, reutilizar os dados carregados pelo widget "budgets":
// Se o widget "budgets" também estiver ativo, os dados de BudgetProgress[]
// já foram buscados — passar como prop, não buscar novamente.
// Se "budgets" estiver inativo, fazer a mesma query apenas para kpi-budget-health.

const healthPercent =
  budgets.length === 0
    ? null
    : budgets.reduce((sum, b) => sum + b.percent, 0) / budgets.length;
```
