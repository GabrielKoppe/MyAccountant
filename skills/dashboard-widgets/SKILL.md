# Skill: Dashboard Widgets

> Como criar, registrar e integrar novos widgets nos dashboards configuráveis do MyAccountant.

---

## Arquitetura do sistema

```
WIDGET_REGISTRY (widget-registry.ts)
        ↓  resolveLayout(context, storedIds)
  ResolvedLayout { active[], available[] }
        ↓  passado como props para o Client Component do dashboard
  DashboardWidgetRenderer
        ↓  buildSegments(active) → Segment[]
  Grid responsivo → nodeMap[widget.id]
        ↓
  Componente do widget (KPI ou Panel)
```

**Fluxo completo:**

1. `WIDGET_REGISTRY` é a fonte da verdade. Nunca no banco.
2. `DashboardLayout` no banco armazena só `widgets: string[]` (ids ativos, por ordem).
3. `resolveLayout` reconcilia o banco com o registry: adiciona novos widgets com `defaultVisible: true`, remove ids órfãos.
4. No Client Component do dashboard, um `nodeMap: Record<string, ReactNode>` mapeia cada `widget.id` ao seu componente renderizado.
5. `DashboardWidgetRenderer` recebe `active` + `nodeMap`, chama `buildSegments`, monta os grids.

---

## Checklist de implementação (6 passos)

```
1. WIDGET_REGISTRY   → registrar id/kind/span/defaultVisible
2. messages/pt-BR.ts → label + description para o editor de configurações
3. widget-icons.tsx  → ícone MUI para o card do editor
4. Query             → função em src/lib/queries/ ou service
5. Componente        → src/components/dashboards/
6. nodeMap           → integrar no Client Component da página
```

---

## Passo 1 — Registro em `widget-registry.ts`

Arquivo: [src/components/dashboards/widget-registry.ts](src/components/dashboards/widget-registry.ts)

```typescript
// Adicionar no array do context correto (monthly | yearly | month_summary)
{ id: "meu-widget", labelKey: "meuWidget", kind: "kpi",   defaultVisible: false },
{ id: "meu-painel", labelKey: "meuPainel", kind: "panel", span: "half", defaultVisible: false },
```

**Regras:**
- `kind: "kpi"` — card pequeno, agrupado em linha, sem `span`.
- `kind: "panel", span: "half"` — metade da largura, renderizados em par quando consecutivos.
- `kind: "panel", span: "full"` — largura total.
- `defaultVisible: false` para **todos** os widgets novos adicionados após o lançamento.
- `defaultVisible: true` só para os widgets da lista original de cada contexto.

---

## Passo 2 — Labels e descrições em `pt-BR.ts`

Arquivo: [src/lib/messages/pt-BR.ts](src/lib/messages/pt-BR.ts)

Adicionar em **dois** lugares dentro de `dashboards.widgets`:

```typescript
// 1. Label exibido como título no editor e nas páginas
monthly: {
  // ...
  meuWidget: "Nome do Widget",
  meuPainel: "Nome do Painel",
},

// 2. Descrição curta no editor de configurações
descriptions: {
  monthly: {
    // ...
    "meu-widget": "Uma linha descrevendo o que este indicador mostra.",
    "meu-painel": "Uma linha descrevendo o que este painel mostra.",
  },
},
```

**Atenção:** a key no `descriptions` usa o `id` (kebab-case), não o `labelKey`.

---

## Passo 3 — Ícone em `widget-icons.tsx`

Arquivo: [src/components/settings/widget-icons.tsx](src/components/settings/widget-icons.tsx)

```typescript
import MeuIconeIcon from "@mui/icons-material/MeuIcone";

export const WIDGET_ICONS: Record<string, ComponentType<SvgIconProps>> = {
  // ...
  "meu-widget": MeuIconeIcon,
  "meu-painel": MeuIconeIcon,
};
```

Escolher um ícone do `@mui/icons-material` que represente visualmente o conteúdo do widget.

---

## Passo 4 — Query de dados

Arquivo: [src/lib/queries/dashboards.ts](src/lib/queries/dashboards.ts) (ou service correspondente)

**Padrão obrigatório:**

```typescript
export async function getMeuWidgetData(accountId: string, monthId: string) {
  // SEMPRE filtrar por accountId — nunca vazar dados entre tenants
  const rows = await prisma.transaction.findMany({
    where: {
      accountId,                    // OBRIGATÓRIO
      month: { id: monthId },
    },
    select: {
      amountCents: true,
      // ...
    },
  });

  // Agregar com BigInt no domínio
  const totalCents = rows.reduce((acc, r) => acc + r.amountCents, 0n);

  // Serializar BigInt como string para passar pela boundary RSC → Client
  return {
    totalCents: totalCents.toString(),
    // outros campos BigInt também como string
  };
}
```

**Regras de query:**
- `accountId` em **todo** `where` que toca dados de Account — sem exceção.
- Retornar BigInt como `string`, nunca como `number` ou `bigint` diretamente (Next.js não serializa BigInt no JSON boundary).
- Evitar N+1: usar `include` ou batch queries quando há listas.
- Queries pesadas → colocar em funções separadas em `src/lib/queries/` para reusar entre contextos.

---

## Passo 5 — Componente do widget

### 5a. Widget KPI

KPI widgets podem ser RSC (sem interatividade) ou Client Components (com gráficos).

**Usar `KpiSparklineCard` para KPIs padrão:**

```typescript
// No nodeMap, dentro do Client Component da página:
"meu-kpi": (
  <KpiSparklineCard
    title={m.dashboards.kpi.meuKpi}
    value={formatCentsToBrl(BigInt(data.totalCents))}
    color="success"           // "default" | "success" | "warning" | "error" | "info"
    icon={MeuIconeIcon}
    currentCents={data.totalCents}
    prevCents={data.prevCents}
    deltaMode={compareMode}
  />
),
```

**KPI customizado (se KpiSparklineCard não serve):**

```typescript
// src/components/dashboards/MeuKpiCard.tsx
"use client";  // só se tiver hooks ou interatividade

import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { formatCentsToBrl } from "@/lib/money";

type Props = { totalCents: string };  // string, não bigint

export function MeuKpiCard({ totalCents }: Props) {
  const total = BigInt(totalCents);  // converter no uso

  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
      <Typography variant="overline" color="text.tertiary">
        Título do KPI
      </Typography>
      <Typography variant="h5" sx={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 500 }}>
        {formatCentsToBrl(total)}
      </Typography>
    </Paper>
  );
}
```

---

### 5b. Widget Panel com gráfico (recharts)

Panels com recharts **devem** ser `"use client"`.

```typescript
// src/components/dashboards/MeuPainel.tsx
"use client";

import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getChartColors } from "@/lib/design-tokens";
import { EmptyState } from "@/components/ui/EmptyState";

type DataPoint = { label: string; valueCents: string };
type Props = { data: DataPoint[] };

export function MeuPainel({ data }: Props) {
  const theme = useTheme();
  const chartColors = getChartColors(theme.palette.mode as "light" | "dark");

  if (data.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" gutterBottom>Título do Painel</Typography>
        <EmptyState size="compact" message="Sem dados para este período." />
      </Paper>
    );
  }

  const chartData = data.map((d) => ({
    label: d.label,
    // CORRETO: Number(BigInt(str)) / 100 para recharts (aceita number, não bigint)
    value: Number(BigInt(d.valueCents)) / 100,
  }));

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="subtitle2" gutterBottom>Título do Painel</Typography>
      <Box sx={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 8,
                fontSize: 11,
                boxShadow: "none",
              }}
            />
            <Bar dataKey="value" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}
```

---

## Passo 6 — Integrar no nodeMap

### Dashboard mensal (Client Component)

O nodeMap fica em [src/components/dashboards/MonthlyDashboardClient.tsx](src/components/dashboards/MonthlyDashboardClient.tsx).

O componente recebe os dados como props serializados (strings para BigInt), monta o `nodeMap`, e passa para `DashboardWidgetRenderer`:

```typescript
// Dentro de MonthlyDashboardClient, na seção do nodeMap:
"meu-widget": data.meuWidget ? (
  <KpiSparklineCard
    title={m.dashboards.kpi.meuWidget}
    value={formatCentsToBrl(BigInt(data.meuWidget.totalCents))}
    color="info"
  />
) : null,

"meu-painel": (
  <MeuPainel data={data.meuPainel} />
),
```

**Regra:** se o widget pode não ter dados (ex: top category quando não há transações), retorne `null` no nodeMap — o renderer ignora entradas `null`.

### Dashboard anual / resumo de mês (RSC)

Para contextos que ainda não têm Client Component próprio, o nodeMap pode ser construído diretamente na RSC page e passado como prop:

```typescript
// src/app/(app)/[accountId]/yearly/page.tsx (RSC)
const data = await getYearOverview(accountId, year);  // query serializada

const nodeMap: Record<string, ReactNode> = {
  "meu-kpi": <MeuKpiCard totalCents={data.totalCents} />,
  "meu-painel": <MeuPainel data={data.meuPainel} />,
};

return <DashboardWidgetRenderer active={resolved.active} nodeMap={nodeMap} />;
```

---

## Padrões obrigatórios

### BigInt — 3 formas de uso

```typescript
// 1. Agregar no servidor (domínio): manter como BigInt
const total = rows.reduce((acc, r) => acc + r.amountCents, 0n);

// 2. Serializar para passar boundary (server → client): sempre toString()
return { totalCents: total.toString() };

// 3. No cliente / na apresentação:
formatCentsToBrl(BigInt(data.totalCents))       // display pt-BR
Number(BigInt(data.totalCents)) / 100           // recharts (float)
BigInt(data.totalCents) >= 0n                   // comparação
```

### Cores de gráficos

```typescript
// SEMPRE via design system — nunca hex hardcoded
const theme = useTheme();
const chartColors = getChartColors(theme.palette.mode as "light" | "dark");
// chartColors[0] = índigo, [1] = verde-musgo, [2] = mostarda, [3] = terracota, [4] = azul-cinza

// Em recharts:
<Bar fill={chartColors[0]} />
<Line stroke={chartColors[1]} />
<Cell fill={chartColors[i % chartColors.length]} />
```

### Estado vazio em panels

```typescript
import { EmptyState } from "@/components/ui/EmptyState";

// Sempre dentro do Paper do painel, com size="compact"
<EmptyState size="compact" message="Sem dados para este período." />
```

### Tooltip de gráfico padronizado

```typescript
const theme = useTheme();

// Estilo consistente para Tooltip do recharts
const tooltipStyle = {
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 8,
  fontSize: 11,
  padding: "4px 8px",
  boxShadow: "none",
};

<Tooltip contentStyle={tooltipStyle} />
```

### Paper wrapper para panels

```typescript
// Padrão de card para panels:
<Paper variant="outlined" sx={{ p: 2.5 }}>
  <Typography variant="subtitle2" gutterBottom>
    {titulo}
  </Typography>
  {/* conteúdo */}
</Paper>
```

---

## Anti-padrões

| ❌ Não fazer | ✅ Fazer |
|---|---|
| `amountCents: number` no retorno de query | `amountCents: string` (toString do BigInt) |
| `fill="#2e7d32"` em recharts | `fill={chartColors[1]}` |
| `defaultVisible: true` em widget novo | `defaultVisible: false` |
| Query sem `accountId` no where | Sempre filtrar por `accountId` |
| `BigInt(...)` diretamente no recharts | `Number(BigInt(str)) / 100` |
| `success.50`, `error.50` | `success.light`, `error.light` (= `success.subtle` no tema) |
| `<Paper elevation={2}>` | `<Paper variant="outlined">` (tema força elevation 0) |
| Criar estado vazio inline | `<EmptyState size="compact">` |
| String de label hardcoded no componente | `m.dashboards.kpi.meuWidget` (via messages) |
| `process.env.X` | `env.X` de `@/lib/env.ts` |
| `console.log(...)` | Logger Pino |

---

## Referência de arquivos

| Arquivo | Papel |
|---|---|
| [src/components/dashboards/widget-registry.ts](src/components/dashboards/widget-registry.ts) | Registry central, `buildSegments`, `resolveLayout` |
| [src/components/dashboards/DashboardWidgetRenderer.tsx](src/components/dashboards/DashboardWidgetRenderer.tsx) | Renderer que recebe `active` + `nodeMap` e monta grids |
| [src/components/dashboards/MonthlyDashboardClient.tsx](src/components/dashboards/MonthlyDashboardClient.tsx) | nodeMap do dashboard mensal |
| [src/components/dashboards/KpiSparklineCard.tsx](src/components/dashboards/KpiSparklineCard.tsx) | Componente base para KPIs com sparkline e delta |
| [src/components/settings/widget-icons.tsx](src/components/settings/widget-icons.tsx) | Mapa id → ícone MUI para o editor de configurações |
| [src/components/settings/WidgetCard.tsx](src/components/settings/WidgetCard.tsx) | Card do widget no editor (active + available) |
| [src/components/settings/DashboardLayoutEditor.tsx](src/components/settings/DashboardLayoutEditor.tsx) | Editor DnD de layout (settings) |
| [src/lib/queries/dashboards.ts](src/lib/queries/dashboards.ts) | Queries de dados dos dashboards |
| [src/lib/messages/pt-BR.ts](src/lib/messages/pt-BR.ts) | Labels + descrições de todos os widgets |
| [src/lib/design-tokens.ts](src/lib/design-tokens.ts) | `getChartColors`, tokens de layout |
| [src/lib/money.ts](src/lib/money.ts) | `formatCentsToBrl` |
| [src/components/ui/EmptyState.tsx](src/components/ui/EmptyState.tsx) | Estado vazio padrão |

---

## Spec de referência

- [specs/33-dashboard-widgets.md](specs/33-dashboard-widgets.md) — spec completa dos widgets existentes e da arquitetura de layout configurável.
- [specs/38-novos-widgets-dashboard.md](specs/38-novos-widgets-dashboard.md) — spec de novos widgets planejados (draft, ainda não implementados).
