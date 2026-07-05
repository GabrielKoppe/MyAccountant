# Skill: Dashboard Widgets

> Como criar, registrar e integrar novos widgets nos dashboards configuráveis do MyAccountant.
> **Arquitetura**: Spec 36 (grade 2D, instâncias configuráveis). Documentação atualizada em 2026-06-20.

---

## Arquitetura do sistema (Spec 36)

```
WIDGET_REGISTRY (_core/widget-registry.ts)
        ↓  resolveLayout(context, StoredWidget[] | null)
  StoredWidget[]  (com x, y, w, h, visible, config)
        ↓  passado como props para o Client Component do dashboard
  DashboardGrid (_core/DashboardGrid.tsx)
        ↓  nodeMap[instanceId] → ReactNode
  CSS Grid posicionado por gridColumn/gridRow
        ↓
  Componente filho recebe renderMode da sizeVariant ativa
```

**Fluxo completo:**

1. `WIDGET_REGISTRY` é a fonte da verdade. Nunca no banco.
2. `DashboardLayout` no banco armazena `widgets: StoredWidget[]` (posição, tamanho, config por instância).
3. `resolveLayout` reconcilia o banco com o registry: descarta `widgetId` desconhecidos, faz fallback de variante desconhecida para `sizeVariants[0]`. **Sem compat-forward** — o layout salvo é respeitado integralmente.
4. No Client Component do dashboard, um `nodeMap: Record<string, ReactNode>` mapeia cada `instanceId` ao seu componente renderizado.
5. `DashboardGrid` recebe `widgets` + `nodeMap`, posiciona via CSS Grid (`gridColumn`, `gridRow`).
6. Componente filho recebe `renderMode` da `sizeVariant` ativa e adapta a apresentação.

**Tipos de widget:**
- **Singleton** (`instantiable !== true`): uma única instância por contexto. O usuário pode adicionar/remover/reposicionar.
- **Instanciável** (`instantiable: true`): N instâncias permitidas (`analysis`, `kpi-custom`, `filtered-transactions`). Cada uma tem seu próprio `config`.

---

## Checklist de implementação (6 passos)

```
1. WIDGET_REGISTRY   → registrar id/kind/sizeVariants/defaultVisible (sem span)
2. messages/pt-BR.ts → label + description + labels de sizeVariants
3. widget-icons.ts   → ícone MUI para o card da paleta
4. Query             → função em src/lib/queries/ ou service
5. Componente        → src/components/dashboards/; receber prop renderMode
6. nodeMap           → integrar no Client Component por widgetId (mapeado para instanceId)
```

---

## Filosofia de Variantes de Tamanho

Todo widget de painel (`kind: "panel"`) deve declarar, pelo menos, **3 variantes de tamanho** no registry. KPIs usam `KPI_VARIANTS` (1×1 e 2×1) — 2 variantes são suficientes para cards compactos.

### Variante compacta ou pequena — `compact`/`small`

Versão **minimalista**: transmite a informação essencial no menor espaço possível.

- Informações secundárias são omitidas ou ocultadas.
- O layout **pode ser reorganizado** em relação ao padrão — mini-barras sem rótulos, donut sem legenda, lista de 3 itens no lugar de gráfico completo, estrutura de carrossel.
- Indicada quando o usuário quer o widget presente sem sacrificar área significativa da grade.

### Variante padrão — `default`

Versão com **melhor custo-benefício** entre espaço e informação. É obrigatoriamente `sizeVariants[0]` — usada no auto-posicionamento inicial.

- Entrega a informação central que o widget se propõe a exibir.
- Layout equilibrado entre leiturabilidade e compacidade.
- Referência: o que as outras variantes adicionam ou removem em relação a esta.

### Variante expandida ou grande — `large`

Versão com **máximo de informação contextual** em torno do conteúdo central.

- O espaço adicional é ocupado com dados complementares: ranking, breakdown por sub-dimensão, série histórica, legenda detalhada com valores absolutos e percentuais, comparações, linha de referência.
- **Princípio inegociável**: cada variante maior deve **adicionar conteúdo real**. Ampliar padding ou tipografia sem adicionar dado é anti-padrão.

### Referência rápida

| Variante | Objetivo | Conteúdo típico |
|---|---|---|
| `compact`/`small` | Sinal mínimo | Forma visual essencial; rótulos e legendas omitidos |
| `default` | Análise padrão | Gráfico principal + legenda essencial |
| `large` | Contexto completo | Gráfico + dados auxiliares (ranking, breakdown, histórico, valores explícitos) |

### Regras no registry

```typescript
// ✅ Padrão: sizeVariants[0] = default (usado no auto-posicionamento)
sizeVariants: [
  { id: "default", labelKey: "default", w: 3, h: 2, renderMode: "default"  },
  { id: "compact", labelKey: "compact", w: 2, h: 1, renderMode: "compact"  },
  { id: "large",   labelKey: "large",   w: 4, h: 3, renderMode: "expanded" },
],

// ✅ KPIs: usar KPI_VARIANTS (1×1 default, 2×1 wide)
// ❌ Variante maior com só espaçamento extra — deve adicionar dado real
// ❌ sizeVariants[0] não sendo a variante default
```

### Como o componente usa `renderMode`

```tsx
// ✅ Correto — adapta pelo renderMode, nunca lê w/h diretamente
export function MeuWidget({ data, renderMode = "default" }: Props) {
  if (renderMode === "compact")  return <MeuWidgetCompact data={data} />;
  if (renderMode === "expanded") return <MeuWidgetExpanded data={data} />;
  return <MeuWidgetDefault data={data} />;
}
```

| `renderMode` | Comportamento esperado |
|---|---|
| `"compact"` | Conteúdo mínimo: valor ou forma visual sem legendas. Layout pode diferir do padrão. |
| `"default"` | Conteúdo padrão: gráfico principal + legenda essencial. |
| `"expanded"` | Conteúdo rico: gráfico + dados contextuais (ranking, breakdown, histórico, valores explícitos). |

---

## Passo 1 — Registro em `widget-registry.ts`

Arquivo: [src/components/dashboards/_core/widget-registry.ts](src/components/dashboards/_core/widget-registry.ts)

```typescript
// ✅ Novo padrão — sizeVariants obrigatório, sem span
{
  id: "meu-widget",
  labelKey: "meuWidget",
  kind: "panel",
  defaultVisible: false,
  sizeVariants: [
    { id: "default", labelKey: "default", w: 3, h: 2, renderMode: "default" },
    { id: "large",   labelKey: "large",   w: 6, h: 3, renderMode: "expanded" },
  ],
}

// ❌ Padrão antigo (spec 33) — NÃO USAR
{ id: "meu-widget", kind: "panel", span: "half", defaultVisible: false }
```

**Regras:**
- `kind: "kpi"` — card pequeno (w:1 ou w:2), agrupado na grade.
- `kind: "panel"` — widget de painel com gráfico, tabela ou lista.
- `sizeVariants[0]` = variante default, usada no auto-posicionamento inicial.
- Cada variante maior DEVE adicionar conteúdo real, não apenas ampliar espaçamentos.
- `defaultVisible: false` para widgets novos adicionados após o lançamento. O usuário os adiciona manualmente pela paleta.
- `instantiable: true` apenas para os 3 tipos parametrizáveis: `analysis`, `kpi-custom`, `filtered-transactions`.

**Contextos disponíveis:**

| Contexto | Rota |
|---|---|
| `monthly` | `/[accountId]/dashboards/monthly/[monthId]` |
| `yearly` | `/[accountId]/dashboards/yearly/[year]` |
| `month_summary` | `/[accountId]/months/[monthId]` (aba Resumo) |

---

## Passo 2 — Labels e descrições em `pt-BR.ts`

Arquivo: [src/lib/messages/pt-BR.ts](src/lib/messages/pt-BR.ts)

```typescript
// 1. Label exibido como título no widget e no editor
dashboards.widgets.monthly: {
  "meu-widget": "Nome do Widget",
},

// 2. Descrição curta no card da paleta
dashboards.widgets.descriptions.monthly: {
  "meu-widget": "Uma linha descrevendo o que este widget exibe.",
},
```

Para labels de `sizeVariants`, usar as chaves existentes em `settings.dashboards.variants`:
```
default, compact, large, wide, small, expanded, medium, giant
```

---

## Passo 3 — Ícone em `widget-icons.ts`

Arquivo: [src/components/dashboards/_core/widget-icons.ts](src/components/dashboards/_core/widget-icons.ts)

```typescript
import MeuIconeIcon from "@mui/icons-material/MeuIcone";

export const WIDGET_ICONS: Record<string, ComponentType<SvgIconProps>> = {
  // ...
  "meu-widget": MeuIconeIcon,
};
```

---

## Passo 4 — Query de dados

Arquivo: [src/lib/queries/dashboards.ts](src/lib/queries/dashboards.ts) (ou service correspondente)

```typescript
export async function getMeuWidgetData(accountId: string, monthId: string) {
  // SEMPRE filtrar por accountId
  const rows = await prisma.transaction.findMany({
    where: { accountId, monthId },
    select: { amountCents: true },
  });
  // BigInt no domínio, serializado como string para a boundary RSC→Client
  const total = rows.reduce((acc, r) => acc + r.amountCents, 0n);
  return { totalCents: total.toString() };
}
```

---

## Passo 5 — Componente do widget

O componente recebe `renderMode` como prop e adapta a apresentação:

```tsx
// src/components/dashboards/panels/MeuWidget.tsx
"use client";  // apenas se usar hooks ou bibliotecas de gráfico

type Props = {
  data: { totalCents: string };
  renderMode?: "compact" | "default" | "expanded";
};

export function MeuWidget({ data, renderMode = "default" }: Props) {
  // ✅ Correto — adapta pelo renderMode, não por w/h
  if (renderMode === "compact") return <MeuWidgetCompact data={data} />;
  if (renderMode === "expanded") return <MeuWidgetExpanded data={data} />;
  return <MeuWidgetDefault data={data} />;

  // ❌ Anti-padrão — nunca ler w/h diretamente no componente
}
```

**Para KPIs**, usar `KpiSparklineCard`:

```tsx
<KpiSparklineCard
  title={m.dashboards.kpi.meuKpi}
  value={formatCentsToBrl(BigInt(data.totalCents))}
  color="success"
  renderMode={getRenderMode(widgets, "monthly", "meu-widget")}
/>
```

---

## Passo 6 — nodeMap por instanceId

O `nodeMap` usa `instanceId` (não `widgetId`) como chave. Para singletons, construir um `nodeByWidgetId` intermediário e depois resolver:

```tsx
// ✅ Padrão correto (Spec 36) — nodeMap por instanceId
const nodeByWidgetId: Record<string, ReactNode> = {
  "meu-widget": <MeuWidget data={data} renderMode={getRenderMode(widgets, "monthly", "meu-widget")} />,
};
const nodeMap: Record<string, ReactNode> = {};
for (const w of widgets) {
  nodeMap[w.instanceId] = nodeByWidgetId[w.widgetId] ?? null;
}

// ❌ Padrão antigo (Spec 33) — nodeMap por widgetId direto — NÃO USAR
const nodeMap: Record<string, ReactNode> = { "meu-widget": <MeuWidget /> };
```

**Para widgets instanciáveis** (cada instância tem config própria):

```tsx
for (const w of widgets) {
  if (w.widgetId === "meu-widget-instantiavel") {
    const config = myConfigSchema.safeParse(w.config);
    nodeMap[w.instanceId] = config.success ? <MeuWidget config={config.data} /> : null;
  }
}
```

---

## Configuração interna (configSchema)

Widgets que aceitam configuração interna declaram `configSchema` (Zod) e `defaultConfig` no registry:

```typescript
import { z } from "zod";

const meuConfigSchema = z.object({
  limit: z.union([z.literal(5), z.literal(10), z.literal(20)]).default(10),
});

{
  id: "meu-widget",
  ...,
  configSchema: meuConfigSchema,
  defaultConfig: { limit: 10 },
}
```

O form de configuração fica em `WidgetConfigForm.tsx` — adicionar um caso no dispatcher:

```typescript
case "meu-widget":
  return <MeuWidgetForm widget={widget} onSave={onSave} />;
```

No `nodeByWidgetId`, buscar a config da instância:

```tsx
const inst = widgets.find(w => w.widgetId === "meu-widget");
const config = meuConfigSchema.safeParse(inst?.config);
nodeByWidgetId["meu-widget"] = (
  <MeuWidget limit={config.success ? config.data.limit : 10} />
);
```

---

## Adicionando ao editor de settings

A paleta (`WidgetPalette.tsx`) lê automaticamente o `WIDGET_REGISTRY` do contexto.
- Singletons: aparecerão na paleta quando não estiverem no layout ativo.
- Instanciáveis: aparecem sempre na paleta (podem ter N instâncias).

Nenhuma alteração manual na paleta é necessária — basta registrar o widget no `WIDGET_REGISTRY`.

---

## Arquivos-chave do sistema

| Arquivo | Responsabilidade |
|---|---|
| `src/components/dashboards/_core/widget-registry.ts` | Definição de todos os widgets (registry + tipos + `resolveLayout`) |
| `src/components/dashboards/_core/DashboardGrid.tsx` | Renderer CSS Grid (dashboard ao vivo) |
| `src/components/dashboards/_core/grid-layout.ts` | Algoritmos de posicionamento (push, resize, bin-pack) |
| `src/components/settings/DashboardGridEditor.tsx` | Editor interativo (settings/dashboards) |
| `src/components/settings/DashboardGridCanvas.tsx` | Canvas drag-and-drop do editor |
| `src/components/settings/WidgetPalette.tsx` | Paleta lateral de widgets disponíveis |
| `src/components/settings/WidgetSettingsPanel.tsx` | Painel de config da instância selecionada |
| `src/components/settings/WidgetConfigForm.tsx` | Forms de configuração interna por widget |
| `src/server/services/dashboard-layout-service.ts` | Leitura e gravação do layout no banco |
| `src/lib/schemas/dashboard-layout.ts` | Schema Zod de `StoredWidget` |


---

## Checklist de implementação (6 passos)

```
1. WIDGET_REGISTRY   → registrar id/kind/span/defaultVisible
2. messages/pt-BR.ts → label + description para o editor de configurações
3. widget-icons.tsx  → ícone MUI para o card do editor
4. Query             → função em src/lib/queries/ ou service
5. Componente        → src/components/dashboards/; receber prop renderMode
6. nodeMap           → integrar no Client Component por widgetId (mapeado para instanceId)
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

## Widgets que MUTAM dados

A maioria dos widgets é read-only. Quando um widget precisa **gravar** (ex.: `checklist` — spec 36 §7.7/7.8, o primeiro widget bem-formado que muta), siga este padrão. **Não** copie o `ActivityWidget` — ele muta com anti-padrão (`useState(props)` sem revalidate → drift; é legado a migrar).

**1. Dados via RSC, carregamento GATED.** A query só roda quando o widget está **visível** no layout resolvido, dentro do `Promise.all` da query da página (espelha `getFilteredTransactionsMap`). Widget novo é `defaultVisible: false` ⇒ a maioria das accounts não deve pagar o custo da query.

```ts
const hasChecklist = summaryWidgets.some((w) => w.widgetId === "checklist" && w.visible);
const [/* ... */, checklistItems] = await Promise.all([
  /* ... */,
  hasChecklist ? listChecklistForMonth(accountId, monthId) : Promise.resolve([]),
]);
```

**2. Revalidação na ACTION, nunca no service.** Sem isso o widget mostra estado velho por Router Cache. Use os helpers de `@/server/api/revalidate.ts` (modo "page", nunca "layout"). Não use `revalidateTag` (o repo não usa tag-cache) nem misture `router.refresh()` com `revalidatePath`.

```ts
export const toggleChecklistCompletionAction = defineAction({
  schema: toggleChecklistCompletionSchema,
  requireRoles: ["owner", "editor"],   // viewer read-only
  handler: async (input, ctx) => {
    await checklistService.toggleChecklistCompletion(input, ctx);
    revalidateMonth(ctx.accountId, input.monthId);   // ← na action
  },
});
```

**3. Feedback com `useOptimistic(props)` + `startTransition`.** PROIBIDO `useState(props)` (não re-hidrata, drifta). A base do otimista é a prop vinda do RSC; `revalidateMonth` reconcilia sozinho (sem `useEffect`/`key` remount). Em erro, `defineAction` retorna `{ ok: false }` (não lança) **antes** do revalidate ⇒ servidor intacto ⇒ o otimista reverte ao fechar a transition. Snackbar via notistack/`useActionFeedback`.

```tsx
const [optimisticItems, applyToggle] = useOptimistic(items, (state, u) =>
  state.map((it) => (it.id === u.itemId ? { ...it, done: u.done } : it)),
);
function toggle(item, done) {
  startTransition(async () => {
    applyToggle({ itemId: item.id, done });
    const res = await toggleAction(accountId, { itemId: item.id, monthId, done });
    if (!res.ok) enqueueSnackbar(msg.error, { variant: "error" });
  });
}
```

**4. Toggle idempotente + guarda tenant write-time.** `on = upsert` no `@@unique`; `off = deleteMany` (evita P2002 em double-click). O service verifica que **todas** as FKs do input (ex.: item **E** month) pertencem a `ctx.accountId` **antes** de gravar — senão um id forjado cria linha cross-tenant. Cobrir com teste de multi-tenancy (mutation sempre tem teste).

**5. Gating de papel.** Mutações com `requireRoles: ["owner", "editor"]`; propague `canEdit` do RSC ao componente para desabilitar controles do viewer (checkbox `disabled`, esconder add/delete).

**Contexto → helper de revalidação** (`@/server/api/revalidate.ts`):

| Escopo da mutação | Helper |
|---|---|
| Estado de um mês (toggle, transação) | `revalidateMonth(accountId, monthId)` |
| Template/config account-scoped (settings) | `revalidate<Entidade>(accountId)` (ex.: `revalidateChecklist`) |
| Mutação inline no widget que afeta ambos | chamar os dois (ex.: create com `monthId` opcional → `revalidateChecklist` + `revalidateMonth`) |

**Custos e trade-offs (leia antes de copiar o padrão):**

- **Cada mutação custa um recomputo full-page.** `revalidateMonth` re-executa **todo** o `getMonthSummaryData` (seções, totais, budgets, varredura de transações, insights). Uma marcação de checkbox paga o recomputo mais caro da aba. É o preço aceito do `revalidatePath` page-level (tag-cache foi rejeitado). Widgets-que-mutam de **alta frequência** são o gatilho para reavaliar revalidação por tag — até lá, é overengineering.
- **`isPending` compartilhado serializa toda a interação do widget.** Um único `useTransition` governa o `disabled` de todos os controles → marcar um item bloqueia o widget inteiro até o round-trip. Intencional (fecha corrida de double-toggle), mas em listas grandes considere pending por-item.
- **Otimismo só onde compensa.** No checklist, só o *toggle* é otimista (frequente, alto valor de feedback); *add/delete* são round-trip puro (insert otimista exigiria id temporário — complexidade sem ganho proporcional). Deixe explícito no componente para o próximo não achar que foi esquecimento.
- **Ação destrutiva de escopo-conta não vai no widget.** Deletar um template recorrente (afeta todos os meses) fica na página de configurações, atrás de `<DialogShell>` de confirmação — não como delete-on-hover no tile do dashboard (footgun).

---

## Referência de arquivos

| Arquivo | Papel |
|---|---|
| [src/components/dashboards/_core/widget-registry.ts](src/components/dashboards/_core/widget-registry.ts) | Registry central, `resolveLayout`, `binPack`, `GRID_CONFIG` |
| [src/components/dashboards/monthly/MonthlyDashboardClient.tsx](src/components/dashboards/monthly/MonthlyDashboardClient.tsx) | nodeMap do dashboard mensal |
| [src/components/dashboards/kpi/KpiSparklineCard.tsx](src/components/dashboards/kpi/KpiSparklineCard.tsx) | Componente base para KPIs com sparkline e delta |
| [src/components/dashboards/_core/widget-icons.ts](src/components/dashboards/_core/widget-icons.ts) | Mapa id → ícone MUI para a paleta e canvas do editor |
| [src/lib/queries/dashboards.ts](src/lib/queries/dashboards.ts) | Queries de dados dos dashboards |
| [src/lib/messages/pt-BR.ts](src/lib/messages/pt-BR.ts) | Labels + descrições de todos os widgets |
| [src/lib/design-tokens.ts](src/lib/design-tokens.ts) | `getChartColors`, tokens de layout |
| [src/lib/money.ts](src/lib/money.ts) | `formatCentsToBrl` |
| [src/components/ui/EmptyState.tsx](src/components/ui/EmptyState.tsx) | Estado vazio padrão |
| [src/components/ui/WidgetContainer.tsx](src/components/ui/WidgetContainer.tsx) | Wrapper visual padrão de panel widgets (borda, título, ícone) |

---

## Spec de referência

- [specs/36-widgets-configuraveis-instanciaveis.md](specs/36-widgets-configuraveis-instanciaveis.md) — spec completa da arquitetura de grade 2D, instâncias configuráveis e editor de settings.
