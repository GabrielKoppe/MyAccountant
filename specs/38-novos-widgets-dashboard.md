# Spec 38 — Novos Widgets de Dashboard

> Status: draft
> Insumo: conversa de produto (2026-06-11) sobre expansão do catálogo de widgets da Spec 33; `prisma/schema.prisma` (Budget, Transaction.responsibleUserId, Transaction.institutionId, Transaction.isRecurring); `src/lib/queries/budgets.ts:140` (getBudgetsWithProgress)
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

A Spec 33 criou o sistema de widgets e migrou os blocos que já existiam hardcoded — mas limitou o catálogo aos widgets pré-existentes. Campos já presentes no schema e queries já implementadas sustentariam visualizações de alto valor que hoje não existem.

- **FEAT-01**: O widget `budgets` (`widget-registry.ts:26`) exibe o progresso de cada meta como uma barra horizontal num painel de largura total. Não existe um indicador consolidado de "saúde geral" das metas — o usuário precisa escanear todas as barras individualmente para ter uma leitura rápida do orçamento como um todo.

- **FEAT-02**: `Transaction.responsibleUserId` (`prisma/schema.prisma:333`) está preenchido nas transações, mas nenhum widget do dashboard mensal ou anual segmenta gastos por membro. Em contas colaborativas (casal, família), não há como ver "quem gastou o quê" na visão de dashboard sem exportar dados.

- **FEAT-03**: `Transaction.institutionId` (`prisma/schema.prisma:329`) está disponível em todas as transações, porém só aparece como dimensão de filtro nas metas (Spec 25). Não há widget que mostre a distribuição de gastos por banco ou plataforma.

- **FEAT-04**: O widget `daily-heatmap` mostra intensidade por dia, mas não agrega por semana. Não há visão de "em qual semana do mês gastei mais" — recorte útil para quem recebe salário, boleto ou benefício em datas fixas dentro do mês.

- **FEAT-05**: `Transaction.isRecurring` (`prisma/schema.prisma:322`) existe e é preenchido, mas não há widget mostrando a proporção de gastos fixos (recorrentes) vs variáveis. Esse dado é fundamental para planejamento: saber quanto do orçamento já está comprometido antes do mês começar.

- **FEAT-06**: Não há KPI de volume de transações em nenhum dos três contextos (`monthly`, `yearly`, `month_summary`). Meses com volume atipicamente alto ou baixo são sinais de comportamento incomum, mas esse dado não está surfaceado.

---

## 2. Solução

Adicionar **9 novos widgets** ao registry — todos com `defaultVisible: false` para não alterar layouts existentes. Cada widget reutiliza dados já disponíveis sem novas migrações de banco.

### 2.1 FEAT-01 — Gauge de saúde das metas

Novo widget `kpi-budget-health` (`kind: "kpi"`, contexto `monthly`).

Exibe o percentual médio de utilização de todas as metas ativas do mês como um **gauge semicircular** (recharts `PieChart` com `startAngle=180, endAngle=0`). A cor muda conforme o percentual: verde (`success.main`) abaixo de 70%, amarelo (`warning.main`) entre 70–90%, vermelho (`danger.main`) acima de 90%. O valor numérico é exibido no centro do arco.

Reutiliza `getBudgetsWithProgress` de `src/lib/queries/budgets.ts:140` — os dados já são carregados pela página do dashboard mensal para o widget `budgets`. Não há nova query.

Se não houver metas ativas no mês, o widget exibe estado vazio padrão (sem renderizar o gauge).

### 2.2 FEAT-02 — Breakdown por membro

Dois novos widgets panel half:

- **`member-breakdown`** (contexto `monthly`): gráfico de barras horizontais com o total de saídas por membro responsável no mês. Transações sem `responsibleUserId` são agrupadas como "Sem responsável". Considera apenas transações em tabelas com `countInMonth = true` e `amountCents > 0`.

- **`member-yearly`** (contexto `yearly`): idem, mas agrega o ano inteiro. Exibe um `BarChart` com barras por membro, uma barra por mês (grouped) ou totais anuais — implementador decide com base na leitura mais clara. Truncar membros ao top-5 se houver muitos.

Nova função `getMemberBreakdown(accountId, monthId)` em `src/lib/queries/dashboards.ts`, seguindo o mesmo padrão das queries de seção/categoria já existentes.

### 2.3 FEAT-03 — Breakdown por instituição

Novo widget **`institution-breakdown`** (`kind: "panel"`, `span: "half"`, contexto `monthly`).

Gráfico donut (recharts `PieChart`) com distribuição de saídas por instituição. Transações sem instituição (`institutionId = null`) agrupadas como "Sem instituição". Considera apenas transações em tabelas com `countInMonth = true` e `amountCents > 0`. Cores via `getChartColors(mode)`.

Nova função `getInstitutionBreakdown(accountId, monthId)` em `src/lib/queries/dashboards.ts`.

### 2.4 FEAT-04 — Gastos por semana

Novo widget **`week-chart`** (`kind: "panel"`, `span: "half"`, contexto `monthly`).

Gráfico de barras verticais (recharts `BarChart`) com 4–5 colunas, cada uma representando uma semana do mês. A semana é calculada a partir de `account_settings.month_start_day` (ver `skills/date-timezone/SKILL.md`). Semanas parciais no início e fim do mês contam normalmente. Considera apenas transações em tabelas com `countInMonth = true` e `amountCents > 0`.

Nova função `getWeeklySpending(accountId, monthId, monthStartDay)` em `src/lib/queries/dashboards.ts`.

### 2.5 FEAT-05 — Recorrentes vs variáveis

Novo widget **`recurring-vs-variable`** (`kind: "panel"`, `span: "half"`, contexto `monthly`).

Gráfico donut com dois segmentos: recorrentes (`isRecurring = true`) e variáveis (`isRecurring = false`). Mostra percentual de cada um e o valor absoluto em tooltip. Considera apenas saídas (`amountCents > 0`) em tabelas com `countInMonth = true`.

Não requer nova query dedicada — pode ser derivado de `getMonthDeepDive` ou de uma query auxiliar simples de `groupBy` por `isRecurring`.

### 2.6 FEAT-06 — Contagem de transações

Novo KPI **`kpi-transaction-count`** adicionado a três contextos:
- `monthly`: contagem de transações do mês (todas, não filtradas por countInMonth)
- `yearly`: contagem total no ano
- `month_summary`: contagem do mês (igual ao monthly)

Pode ser derivado das queries de dados já carregadas pela página — não exige nova query se o count for incluído como campo extra nos dados existentes.

---

## 3. User Stories

- Como usuário que define metas de orçamento, quero um indicador visual único de saúde do orçamento, para saber em um relance se estou dentro ou acima dos limites sem escanear cada barra individualmente.
- Como usuário de uma conta compartilhada (casal, família), quero ver rapidamente quem são os maiores gastadores do mês no dashboard, para identificar desequilíbrios sem exportar dados.
- Como usuário, quero saber qual semana do mês concentra meus maiores gastos, para ajustar o comportamento nas semanas seguintes.
- Como usuário que planeja orçamento, quero ver a proporção de gastos fixos vs variáveis, para entender quanto do meu orçamento já está comprometido antes do mês começar.
- Como usuário, quero poder adicionar o widget de gastos por instituição no meu dashboard mensal, para entender quais canais de pagamento uso mais.

---

## 4. Critérios de Aceitação

**FEAT-01 — kpi-budget-health:**
- QUANDO `kpi-budget-health` está ativo e há metas cadastradas no mês, O WIDGET DEVE exibir um gauge semicircular recharts com o percentual médio de utilização das metas.
- SE o percentual médio for < 70%, O ARCO DO GAUGE DEVE ter cor `success.main`.
- SE o percentual médio for entre 70% e 90% (inclusive), O ARCO DEVE ter cor `warning.main`.
- SE o percentual médio for > 90%, O ARCO DEVE ter cor `danger.main`.
- SE não houver metas ativas no mês, O WIDGET DEVE exibir o estado vazio padrão em vez do gauge.
- O widget NÃO DEVE causar nova query além das já carregadas pela página do dashboard mensal.

**FEAT-02 — member-breakdown / member-yearly:**
- QUANDO `member-breakdown` está ativo, O WIDGET DEVE listar apenas membros com pelo menos uma transação de saída no mês.
- QUANDO há transações sem responsável, ELAS DEVEM aparecer agrupadas como "Sem responsável" (não omitidas silenciosamente).
- O widget NÃO DEVE incluir transações de tabelas com `countInMonth = false`.
- O widget NÃO DEVE vazar dados de outras Accounts (filtro por `accountId` obrigatório).
- QUANDO um membro não tem nome, O WIDGET DEVE exibir seu email como fallback.

**FEAT-03 — institution-breakdown:**
- QUANDO `institution-breakdown` está ativo, O DONUT DEVE agrupar apenas saídas (`amountCents > 0`) em tabelas com `countInMonth = true`.
- QUANDO transações não têm instituição, ELAS DEVEM aparecer como "Sem instituição".
- As fatias DEVEM usar `getChartColors(mode)` para cor, não hexadecimais hardcoded.

**FEAT-04 — week-chart:**
- QUANDO `week-chart` está ativo, AS SEMANAS DEVEM ser calculadas a partir de `account_settings.month_start_day`, não a partir do dia 1 do mês calendário.
- O GRÁFICO DEVE exibir entre 4 e 6 barras dependendo do número de semanas no período do mês.
- Semanas parciais no início ou fim do período DEVEM ser incluídas, não descartadas.

**FEAT-05 — recurring-vs-variable:**
- QUANDO `recurring-vs-variable` está ativo, O DONUT DEVE ter exatamente dois segmentos: recorrentes e variáveis.
- SE todas as transações do mês forem do mesmo tipo, O DONUT DEVE ainda exibir o total correto (um segmento completo, outro vazio ou com valor mínimo para manter a forma visual).
- O valor no tooltip DEVE ser formatado em reais (não centavos) usando o helper de formatação do projeto.

**FEAT-06 — kpi-transaction-count:**
- QUANDO `kpi-transaction-count` está ativo no contexto `monthly`, O KPI DEVE exibir a contagem de transações visíveis do mês.
- O mesmo widget ID DEVE funcionar nos contextos `yearly` e `month_summary` com o count do período correspondente.

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
- Dark mode: os widgets DEVEM suportar dark mode usando tokens semânticos e `getChartColors(mode)`, mas testes visuais formais de dark mode ficam fora do escopo desta spec.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Gauge style | Semicírculo recharts (sem ponteiro/agulha) | Ponteiro requer SVG customizado complexo; o arco preenchido transmite a mesma informação com menos código e melhor responsividade |
| Gauge métrica | Média simples dos percentuais das metas | `sum(spent) / sum(budget)` favorece metas grandes e distorce a percepção; a média trata cada meta igualmente |
| `responsibleUserId = null` | Agrupar como "Sem responsável" | Omitir silenciosamente esconde uma porção potencialmente grande dos gastos; a transparência é preferível |
| `institutionId = null` | Agrupar como "Sem instituição" | Mesma razão acima |
| Semanas do mês | Baseadas em `month_start_day`, não no calendário gregoriano | Mantém consistência com o restante do app; semana 1 começa sempre no `month_start_day` |
| `defaultVisible` dos novos widgets | `false` para todos | Não alterar layouts existentes de quem já usa o app; o usuário ativa sob demanda nas configurações |
| Truncamento em `member-yearly` | Top-5 membros por total | Contas com muitos membros tornam o gráfico ilegível; top-5 cobre a maioria dos casos reais |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Registro dos novos widgets | `src/components/dashboards/widget-registry.ts` |
| Labels e descrições | `src/lib/messages/pt-BR.ts` |
| Ícones dos novos widgets | `src/components/settings/widget-icons.tsx` |
| Queries de breakdown por membro e instituição | `src/lib/queries/dashboards.ts` |
| Query semanal | `src/lib/queries/dashboards.ts` |
| Componente gauge | `src/components/dashboards/widgets/BudgetHealthGauge.tsx` (novo) |
| Componente breakdown membro | `src/components/dashboards/widgets/MemberBreakdownChart.tsx` (novo) |
| Componente breakdown instituição | `src/components/dashboards/widgets/InstitutionBreakdownChart.tsx` (novo) |
| Componente semanas | `src/components/dashboards/widgets/WeeklySpendingChart.tsx` (novo) |
| Componente recorrentes vs variáveis | `src/components/dashboards/widgets/RecurringVsVariableChart.tsx` (novo) |
| Integração no dashboard mensal | `src/components/dashboards/MonthlyDashboardClient.tsx` |
| Integração no dashboard anual | `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx` |

### Entradas no registry (novos WidgetDef)

```typescript
// src/components/dashboards/widget-registry.ts

// monthly — acrescentar ao array existente:
{ id: "kpi-budget-health",       labelKey: "budgetHealth",        kind: "kpi",   defaultVisible: false },
{ id: "kpi-transaction-count",   labelKey: "transactionCount",    kind: "kpi",   defaultVisible: false },
{ id: "kpi-recurring-total",     labelKey: "recurringTotal",      kind: "kpi",   defaultVisible: false },
{ id: "member-breakdown",        labelKey: "memberBreakdown",     kind: "panel", span: "half", defaultVisible: false },
{ id: "institution-breakdown",   labelKey: "institutionBreakdown",kind: "panel", span: "half", defaultVisible: false },
{ id: "week-chart",              labelKey: "weekChart",           kind: "panel", span: "half", defaultVisible: false },
{ id: "recurring-vs-variable",   labelKey: "recurringVsVariable", kind: "panel", span: "half", defaultVisible: false },

// yearly — acrescentar ao array existente:
{ id: "kpi-transaction-count",   labelKey: "transactionCount",    kind: "kpi",   defaultVisible: false },
{ id: "member-yearly",           labelKey: "memberYearly",        kind: "panel", span: "half", defaultVisible: false },

// month_summary — acrescentar ao array existente:
{ id: "kpi-transaction-count",   labelKey: "transactionCount",    kind: "kpi",   defaultVisible: false },
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

### Query de breakdown por membro (padrão a seguir)

```typescript
// src/lib/queries/dashboards.ts — nova função
export async function getMemberBreakdown(
  accountId: string,
  monthId: string,
): Promise<{ memberId: string | null; memberName: string; totalCents: bigint }[]> {
  // Agrupa por responsibleUserId, considerando apenas transações que contam no mês
  // Usa prisma.transaction.groupBy ou raw query
  // Faz join com AccountMember/User para nome — ou busca em batch separado
  // Retorna ordenado por totalCents DESC
  // Garante filtro por accountId (multi-tenancy)
}
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
