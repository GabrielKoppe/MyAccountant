# Spec 11 — Dashboards

> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`logging`](../skills/logging/SKILL.md)

## 1. Propósito

Define a área de **Dashboards**: visualizações e análises dos dados financeiros ao longo do tempo, com comparações entre meses, sections e tabelas.

## 2. Princípios

1. **Dados são read-only** aqui. Nenhuma edição neste módulo.
2. **Performance importa**: queries agregadas, paginação, cache.
3. **Composabilidade**: usuário monta o dashboard que precisa.
4. **MVP minimalista**: 3-4 visualizações úteis, não 20 medíocres.

## 3. Estrutura

```
/dashboards (dentro de uma Account)
├── /                       — Redireciona para /yearly/[anoMaisRecente]
├── /yearly/[year]          — ✅ Visão anual (implementado)
├── /monthly/[monthId]      — ✅ Deep dive de um mês (implementado — Wave 1 completo)
├── /sandbox                — ⏳ Sandbox de análise ad-hoc (spec 17-sandbox.md)
├── /compare                — ⏳ v2
└── /custom/[id]            — ⏳ v2
```

**Bibliotecas de gráficos**:
- `recharts` (instalado): sparklines, treemap, barras, pizzas.
- `@nivo/sankey` (instalado na Wave 1): diagrama de Sankey.
- CSS Grid + MUI: Calendar Heatmap (sem lib extra).

## 4. Dashboard Anual (`/dashboards/yearly/[year]`) ✅

### 4.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Visão Anual · [2026 ▼ YearSelector]                             │
├──────────────────────────────────────────────────────────────────┤
│  [ Total do Ano ]  [ Média Mensal ]  [ Melhor Mês ]  [ Pior Mês ]│
├──────────────────────────────────────────────────────────────────┤
│  [ Badge: X transações pendentes (só se pendingCount > 0) ]      │
├──────────────────────────────────────────────────────────────────┤
│  [ MonthCardGrid: cards clicáveis por mês ]                      │
├──────────────────────────────────────────────────────────────────┤
│  [   BarChart: barras por mês × seção — "Totais por Mês"     ]   │
│      Click em barra → navega para /monthly/[monthId]             │
├──────────────────────────────────────────────────────────────────┤
│  [   Análises Salvas: mini-gráficos das análises fixadas     ]   │
│      + botão "Abrir Sandbox →"  (ver spec 17-sandbox.md §9)      │
├──────────────────────────────────────────────────────────────────┤
│  [   CategoryBarList: top 10 categorias com barra de progresso ] │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Cards (KPIs) implementados

- **Total do Ano**: soma dos totais de cada mês (respeitando `countType` de cada seção).
- **Média Mensal**: `totalAno / qtdMeses`.
- **Melhor Mês** / **Pior Mês**: maior e menor totais calculados entre os meses existentes.
- **Transações Pendentes**: count de `isPending=true` no ano — exibido só se > 0.

### 4.3 Gráfico de barras mensais

**Tipo**: barras agrupadas side-by-side por Section.
**Eixo X**: meses do ano com dados (não todos os 12, só os que existem).
**Eixo Y**: valor em R$ (seções com `countType=subtract` aparecem como negativo).
**Séries**: uma cor por Section; seções `countType=ignore` são omitidas.
**Click em barra**: navega para `/dashboards/monthly/[monthId]`.

> **Atenção ao `countType`**: seções `subtract` têm seu valor negado no gráfico (`-Math.abs(value)`) para dar intuição visual de despesa vs. receita. O **total do mês** no KPI é calculado corretamente pelo `calculateMonthTotal()` de `month-service.ts`.

## 5. Visão Mensal — Deep Dive (`/dashboards/monthly/[monthId]`) ✅ Wave 1

### 5.1 Layout Wave 1

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← 2026  |  Junho/2026                  [Comparar com: prev month ▼] │
├─────────────────────────────────────────────────────────────────────┤
│ [Total ∿ ▲5%] [Entradas ∿] [Saídas ∿] [Poupança %] [Maior Cat] [⏳]│
├─────────────────────────────────────┬───────────────────────────────┤
│  Gastos por Dia (Calendar Heatmap)  │  Distribuição por Categoria   │
│  [S M T W T F S grid]              │  (recharts Treemap hierárquico)│
│  click em dia → DrillDown Drawer    │  click → sub → DrillDown      │
├─────────────────────────────────────┴───────────────────────────────┤
│  Fluxo de Dinheiro (Sankey @nivo)                                   │
│  [Salário] ──→ [Total Disponível] ──→ [Mercado]                     │
│  [Extras]  ──→                    ──→ [Aluguel]                     │
│                                   ──→ [Sobra / Poupança]            │
├─────────────────────────────────────┬───────────────────────────────┤
│  Por Seção (pizza)                  │  Por Categoria (pizza)        │
├─────────────────────────────────────┴───────────────────────────────┤
│  Maiores Transações (tabela)                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 KPI Cards com Sparkline (`KpiSparklineCard`)

| Card | Dado | Sparkline | Delta |
|---|---|---|---|
| Total do Mês | `monthTotal` | total últimos 6 meses | ✅ |
| Entradas | soma seções `add` | income últimos 6 meses | ✅ |
| Saídas | soma seções `subtract` | expense últimos 6 meses | ✅ |
| Taxa de Poupança | `(income - expense) / income * 100` | — | — |
| Maior Categoria | top category do mês | — | — |
| Pendentes | `count(isPending=true)` | — | — |

**Comparison toggle**: controla qual período de comparação é exibido:
- `none` — sem delta
- `prevMonth` — delta vs mês anterior (sparkline[−2])
- `prevYear` — delta vs mesmo mês ano anterior (query separada)
- `avg3m` — delta vs média dos últimos 3 meses

### 5.3 Calendar Heatmap (`DailyHeatmap`)

- **Implementação**: CSS Grid 7 colunas (DOM–SEX) via MUI Box. Zero bibliotecas externas.
- **Dados**: transações em seções `subtract`/`neutral`, agrupadas por dia (`getUTCDate()`).
- **Intensidade**: escala de azul claro → azul escuro. Threshold: `>maxCents/4`, `>maxCents/2`, `>3*maxCents/4`.
- **Click no dia** → abre `DrillDownDrawer` com as transações daquele dia.
- **Legenda**: barra de escala de cores.

### 5.4 Category Treemap (`CategoryTreemap`)

- **Lib**: recharts `<Treemap>` + custom `<Cell>` renderer.
- **Nível 1**: categorias (tamanho proporcional ao total absoluto de centavos).
- **Drill-down**: click em categoria → mostra subcategorias daquela categoria.
- **Click em subcategoria** → abre `DrillDownDrawer` com transações daquele leaf.
- **Cores**: paleta fixa de 12 cores (`PALETTE`), consistente entre root e drill-down.
- **Breadcrumb**: botão "← Todas as categorias" ao entrar em drill-down.

### 5.5 Sankey Diagram (`SankeyChart`)

- **Lib**: `@nivo/sankey` v0.99 (SSR disabled via `next/dynamic`).
- **Nós**: seções `add` (entradas) → nó central "Total Disponível" → top 8 categorias de saída → "Sobra / Poupança" (se positivo) → "Outros gastos" (despesas sem categoria).
- **Links**: income_section → total (sum per section); total → expense_category (sum per category across subtract sections).
- **Tooltip**: exibe valor em BRL formatado.
- **Fallback**: "Sem entradas registradas" se `nodes.length === 0`.
- **Carregamento**: `dynamic` com loading spinner (evita erro de SSR do D3).

### 5.6 DrillDown Drawer (`DrillDownDrawer`)

- MUI `<Drawer anchor="right">` com largura 480px (full em mobile).
- Título parametrizável (ex: "Gastos do dia 15/6/2026", "Mercado › Padaria").
- Tabela de transações: data, descrição, seção, valor, badges favorita/pendente.
- Rodapé com total das transações exibidas.
- IDs de transações passados como parâmetro; fetch via `getDrawerTransactionsAction` (lazy, em `useTransition`).

### 5.7 Comparison Toggle (`ComparisonToggle`)

- Select com 4 opções: none, prev month, prev year, avg 3m.
- Desabilita opções sem dados (ex: sem mês equivalente no ano anterior).
- Estado em `useState` dentro de `MonthlyDashboardClient`; afeta o `deltaMode` dos 3 KPI cards com sparkline.

## 6. Arquitetura

### 6.1 Componentes

```
src/components/dashboards/
├── KpiCard.tsx              ✅ — card básico (anual)
├── KpiSparklineCard.tsx     ✅ Wave 1 — card com sparkline + delta
├── MonthlyBarChart.tsx      ✅ — BarChart: meses × seções
├── YearlyLineChart.tsx      ✅ — LineChart: evolução mensal
├── SectionPieChart.tsx      ✅ — PieChart: por seção
├── CategoryPieChart.tsx     ✅ — PieChart: por categoria
├── CategoryBarList.tsx      ✅ — lista categorias com LinearProgress
├── YearSelector.tsx         ✅ — Select de ano
├── PinnedAnalysesSection.tsx ⏳ Onda 2 — mini-gráficos das análises fixadas no dashboard anual
├── DailyHeatmap.tsx         ✅ Wave 1 — CSS Grid heatmap
├── CategoryTreemap.tsx      ✅ Wave 1 — recharts Treemap hierárquico
├── SankeyChart.tsx          ✅ Wave 1 — @nivo/sankey
├── DrillDownDrawer.tsx      ✅ Wave 1 — MUI Drawer com tx list
├── ComparisonToggle.tsx     ✅ Wave 1 — Select de período de comparação
└── MonthlyDashboardClient.tsx ✅ Wave 1 — orquestrador client para mensal
```

### 6.2 Queries

```ts
// src/lib/queries/dashboards.ts

export async function getYearOverview(accountId, year)
// → { sections, monthSummaries, topCategories, pendingCount, allYears }

export async function getMonthDeepDive(accountId, monthId)
// → { sections, sectionTotals, monthTotal, topCategories, topTransactions, favoriteTransactions }

export async function getMonthSparklineData(accountId, currentMonthId)
// → { totalSparkline, incomeSparkline, expenseSparkline, prevMonthTotal, prevMonthIncome, prevMonthExpense }

export async function getComparisonData(accountId, currentMonthId)
// → { prevYearSameMonth, avg3months } (each has total/income/expense)

export async function getDailyTotals(accountId, monthId, subtractSectionIds)
// → DayTotal[] (day, absoluteCents, transactionCount, transactionIds)

export async function getCategoryTreemapData(accountId, monthId)
// → TreemapCategory[] (categoryId, name, totalCents, children[])

export async function getSankeyData(accountId, monthId, sections, sectionTotals)
// → SankeyData (nodes[], links[])

export async function getTransactionsByIds(accountId, ids)
// → DrillDownTransaction[]

export async function getYearDeepDive(accountId, year)
// → { sections, monthSummaries, topCategories, topInstitutions, allYears } — sem página dedicada (v2)
```

### 6.3 Actions

```ts
// src/actions/dashboards.ts
export const getDrawerTransactionsAction  // lazy fetch para DrillDownDrawer
```

## 7. Cálculos importantes

### 7.1 Total do mês

```ts
function calculateMonthTotal(sections, sectionTotals): bigint {
  let total = 0n;
  for (const s of sections) {
    const v = sectionTotals[s.id] ?? 0n;
    if (s.countType === "add")      total += v;
    else if (s.countType === "subtract") total -= v;
    else if (s.countType === "neutral")  total += v;
    // "ignore" → não contribui
  }
  return total;
}
```

### 7.2 Income / Expense

```ts
const income  = addSections.reduce((sum, s) => sum + abs(sectionTotals[s.id]), 0n);
const expense = subtractSections.reduce((sum, s) => sum + abs(sectionTotals[s.id]), 0n);
const savingsRate = income > 0n ? (income - expense) * 100n / income : 0n;
```

### 7.3 BigInt → Number para charts

```ts
// APENAS para alimentar recharts/nivo — nunca para cálculos
const reais = Number(BigInt(cents)) / 100;
```

> **Atenção**: `Number(BigInt)` é seguro para valores até 2^53 centavos ≈ R$ 90 trilhões. Suficiente para o domínio.

## 8. Performance

- **Cache**: usar `unstable_cache` do Next.js com tags (`account:${id}`, `month:${monthId}`).
- **Invalidação**: após mutações em transactions, revalidar tags.
- **Limites**: queries de dashboard sempre limitadas a 1 ano por vez. Comparações máximo 6 meses.
- **Suspense**: cada card/gráfico em um `<Suspense>` próprio com skeleton (v2).
- **Sankey**: carregado com `next/dynamic { ssr: false }` — evita hidratação de D3 no servidor.

## 9. Padrão de serialização

Todas as queries retornam `amountCents` como **`string`** (BigInt serializado). RSC passa para Client Components; o client converte com `BigInt(str)` antes de operar e `Number(BigInt(str)) / 100` apenas para alimentar recharts/nivo.

## 10. Acesso

| Página | Owner | Editor | Viewer |
|---|---|---|---|
| `/dashboards/*` | ✅ | ✅ | ✅ |

> Viewer **lê** mas não cria dashboards customizados.

## 11. Edge cases

- **Ano sem nenhum mês criado**: dashboard mostra mensagem "Nenhum dado neste ano. Crie um mês para começar."
- **Mês com 0 transações**: gráficos mostram mas com valor zero / estado vazio.
- **BigInt em libraries de gráfico**: converter para Number antes. Atenção a precisão se valores > 2^53.
- **Mudança de countType de section**: dashboards recalculam em cada request (sem cache de totais em banco).
- **Sankey sem income**: renderiza mensagem "Sem entradas registradas neste mês."
- **Heatmap sem subtract sections**: bloco não é renderizado.
- **Treemap sem categorias**: mensagem "Sem categorias registradas neste mês."

## 12. Roadmap (ondas futuras)

### Onda 2 — Sandbox (ver `specs/17-sandbox.md`)

- [ ] Rota `/sandbox` com painel de análise ad-hoc.
- [ ] `SavedAnalysis` (nova tabela no banco) — análises nomeadas e salvas.
- [ ] Tipos: bar_grouped, bar_stacked, line, area, pie, donut.
- [ ] Dimensões: groupBy (mês/seção/categoria) + seriesBy (seção/categoria/membro/nenhum).
- [ ] Métricas: total, income, expense, count, avg.
- [ ] Botão "Sandbox" no dashboard anual.

### Onda 3 (v2)
- [ ] Visão anual detalhada (`/yearly/[year]` com line chart de evolução + comparação com ano anterior).
- [ ] Tela `/compare` (ad-hoc entre 2+ meses).
- [ ] Exportação: CSV bruto da visualização + PNG do gráfico (`html-to-image`).
- [ ] `unstable_cache` por accountId/monthId com invalidação por tag.
- [ ] `<Suspense>` por seção para carregamento progressivo.

### Onda 3 (v3)
- [ ] Goals / metas por section (orçamento mensal com barra de progresso).
- [ ] Alertas: notificação quando gasto > X em categoria.
- [ ] Forecast: previsão de saldo com base em histórico + pendentes.
- [ ] Dashboards customizados e salvos.
- [ ] Export para Excel formatado.
