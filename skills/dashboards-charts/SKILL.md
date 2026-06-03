# SKILL — Dashboard Charts

## Quando usar

Sempre que criar ou modificar visualizações no módulo de dashboards. Cobre padrões de conversão BigInt→Number, paleta de cores consistente via design system, integração de libs (recharts, @nivo/sankey), DrillDown drawer, e o padrão de sparkline.

---

## 1. BigInt → Number para charts

Regra: **converter para Number somente na borda de renderização**, nunca antes de terminar todos os cálculos.

```ts
// ✅ Certo — somente na hora de montar o dado do gráfico
const chartData = sectionTotals.map((s) => ({
  name: s.name,
  value: Number(BigInt(s.totalCents)) / 100, // só aqui
}));

// ❌ Errado — conversão cedo, perde precisão antes de somar
const value = Number(s.totalCents) / 100; // e depois faz soma
```

Precisão: `Number(BigInt)` é seguro para até 2^53 centavos ≈ R$ 90 trilhões. Suficiente para o domínio.

**Padrão de serialização RSC → Client**:
- Queries retornam `amountCents: string` (BigInt serializado via `.toString()`).
- Cliente recebe string, converte com `BigInt(str)` para calcular, `Number(BigInt(str))/100` apenas para charts.

---

## 2. Paleta de cores — design system

**Nunca usar hex hardcoded em charts.** Toda cor vem de uma dessas duas fontes:

### 2a. Paleta de chart: `getChartColors(mode)`

Para séries de dados sem significado semântico (categorias, seções por índice, nós Sankey):

```ts
import { getChartColors } from "@/lib/design-tokens";
import { useTheme } from "@mui/material/styles";

const theme = useTheme();
const chartPalette = getChartColors(theme.palette.mode as "light" | "dark");
// → array de 8 cores dessaturadas e harmoniosas (índigo, verde-musgo, mostarda, terracota, azul-cinza, lavanda, âmbar, teal)

// Em SVG (recharts Cell, Treemap):
<Cell fill={chartPalette[i % chartPalette.length]} />

// Mapa estável por ID:
const colorMap = useMemo(() => {
  const m = new Map<string, string>();
  items.forEach((item, i) => m.set(item.id, chartPalette[i % chartPalette.length]));
  return m;
}, [items, chartPalette]);
```

### 2b. Cores semânticas: `useTheme()` + `theme.palette.*`

Para dados com significado fixo (section countType, status financeiro):

```ts
const theme = useTheme();

// SectionCountType → cor semântica
const countTypeColors: Record<SectionCountType, string> = {
  add:      theme.palette.success.main,   // verde-musgo (design system)
  subtract: theme.palette.error.main,     // terracota (= danger.main no tema)
  neutral:  theme.palette.info.main,      // índigo (= accent.primary no tema)
  ignore:   theme.palette.text.disabled,  // cinza apagado
};

// Uso em SVG:
<Cell fill={countTypeColors[entry.countType]} />
```

> `theme.palette.error.main` é mapeado para `danger.main` do design system — não é o vermelho saturado MUI padrão.

### 2c. Cores para texto/grid (eixos, linhas de grade)

```ts
const tickColor  = theme.palette.text.secondary;  // labels dos eixos
const gridColor  = theme.palette.divider;          // linhas de grade e ReferenceLine
const hoverFill  = theme.palette.action.hover;     // cursor hover nas barras
```

---

## 3. Componentes compartilhados de chart

### ChartTooltip e PieLegend

```tsx
import { ChartTooltip, PieLegend } from "@/components/dashboards/ChartTooltip";

// Tooltip em BarChart / LineChart
<Tooltip
  cursor={{ fill: theme.palette.action.hover }}
  content={(props: any) => {
    if (!props.active || !props.payload?.length) return null;
    const entry = props.payload[0];
    return (
      <ChartTooltip
        active
        payload={[{ name: entry.payload.name, value: entry.value, color: entry.fill }]}
        formatValue={() => formatCentsToBrl(BigInt(entry.payload.raw))}
        hideName={false}
      />
    );
  }}
/>

// Legenda em PieChart
<Legend iconSize={0} content={(props: any) => <PieLegend {...props} />} />
```

`ChartTooltip` usa `background.paper` + `border.subtle` + JetBrains Mono para valores. `PieLegend` renderiza círculos coloridos + nomes sem bordas.

---

## 4. recharts — padrões e gotchas

### Donut chart (PieChart)

```tsx
<PieChart>
  <Pie
    data={data}
    cx="50%"
    cy="46%"
    outerRadius={88}
    innerRadius={52}    // ← faz o donut
    paddingAngle={2}    // ← espaço entre fatias
    strokeWidth={0}     // ← sem borda branca entre fatias
    dataKey="value"
  >
    {data.map((_, i) => (
      <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
    ))}
  </Pie>
  <Tooltip content={...} />
  <Legend iconSize={0} content={(props: any) => <PieLegend {...props} />} />
</PieChart>
```

> Não usar o prop `label` no `<Pie>` — labels inline nas fatias ficam confusas. Usar `<Legend>` com `PieLegend`.

### BarChart vertical (horizontal bars)

```tsx
<BarChart
  data={data}
  layout="vertical"
  margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
>
  <XAxis type="number" hide />
  <YAxis
    type="category"
    dataKey="name"
    width={110}
    tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
    tickLine={false}
    axisLine={false}
  />
  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
    {data.map((entry) => <Cell key={entry.id} fill={...} />)}
  </Bar>
</BarChart>
```

### onClick em Bar — padrão correto

**Sempre colocar `onClick` no `<Bar>`, não no `<BarChart>`**. O `BarChart onClick` usa `activePayload` que pode ser `undefined` ao clicar fora das barras.

```tsx
<Bar
  dataKey="value"
  onClick={(data: any) => {
    // data é diretamente o objeto da barra clicada
    if (data?.id) router.push(`/${accountId}/months/${monthId}?tab=${data.id}`);
  }}
  style={{ cursor: "pointer" }}
>
  {data.map((entry) => <Cell key={entry.id} fill={...} />)}
</Bar>
```

### Treemap com click

```tsx
// onClick no <Treemap>, não no content/CustomCell — o content não propaga eventos
<Treemap
  data={data}
  dataKey="value"
  onClick={(nodeData: any) => handleCellClick(nodeData as TreemapNode)}
  content={<CustomCell />}
/>
```

### Custom Treemap Cell

```tsx
function CustomCell(props: { x?: number; y?: number; width?: number; height?: number; name?: string; fill?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, name, fill } = props;
  const theme = useTheme();
  const separator = theme.palette.background.default;  // borda entre células

  if (width < 20 || height < 20) return null; // células pequenas demais

  return (
    <g style={{ cursor: "pointer" }}>
      <rect
        x={x + 1} y={y + 1} width={width - 2} height={height - 2}
        style={{ fill: fill ?? theme.palette.surface.subtle, stroke: separator, strokeWidth: 2 }}
        rx={4}
      />
      {/* texto: rgba(255,255,255,0.92) para label, rgba(255,255,255,0.72) para valor */}
      {width > 48 && height > 26 && (
        <text x={x + width / 2} y={y + height / 2}
          textAnchor="middle" dominantBaseline="middle"
          style={{ fill: "rgba(255,255,255,0.92)", fontSize: Math.min(13, Math.max(9, width / 9)), fontWeight: 600 }}
        >
          {name && name.length > 16 ? name.slice(0, 15) + "…" : name}
        </text>
      )}
    </g>
  );
}
```

### Formatadores de tooltip

```tsx
// always cast para any — recharts v3 tem tipos estritos que conflitam
formatter={(v: any) => [formatCentsToBrl(BigInt(Math.round(Number(v) * 100))), ""]}
labelFormatter={(label: any) => String(label)}
```

---

## 5. @nivo/sankey — padrões

### SSR — sempre usar `next/dynamic`

```tsx
const SankeyChart = dynamic(() => import("./SankeyChart").then((m) => m.SankeyChart), {
  ssr: false,
  loading: () => (
    <Box sx={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Typography variant="caption" color="text.secondary">Carregando fluxo...</Typography>
    </Box>
  ),
});
```

### Cores de nós — `getChartColors(mode)` via mapa estável

```tsx
const chartPalette = getChartColors(theme.palette.mode as "light" | "dark");

const nodeColorMap = new Map(
  data.nodes.map((n, i) => [n.id, chartPalette[i % chartPalette.length]])
);

<ResponsiveSankey
  colors={(node: any) => nodeColorMap.get(node.id) ?? "#90a4ae"}
  linkOpacity={isDark ? 0.3 : 0.4}
  linkBlendMode={isDark ? "screen" : "multiply"}
  labelTextColor={isDark ? "#e0e0e0" : "#333333"}
/>
```

### Tooltip do nivo — inline (não usa ThemeProvider interno)

```tsx
function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(20,20,20,0.88)", color: "#fff",
      borderRadius: 6, padding: "8px 12px", fontSize: 12,
      boxShadow: "0 2px 8px rgba(0,0,0,0.4)", pointerEvents: "none",
    }}>
      {children}
    </div>
  );
}
```

> `@nivo` renderiza tooltips em um portal fora da árvore MUI — `<Box sx={{ bgcolor: "..." }}>` não funciona lá dentro. Usar style inline no tooltip do nivo.

---

## 6. Calendar Heatmap — Warm Calm gradient

Sem biblioteca externa. MUI Box + CSS Grid. **Gradiente de 5 níveis do design system:**

```ts
const HEAT_COLORS_LIGHT = [
  "#F5F4F0",  // 0 — vazio (background.subtle)
  "#EAEDFB",  // 1 — accent.primarySubtle
  "#C5CBEF",  // 2 — intermediário
  "#8B98E8",  // 3 — intermediário
  "#4E5FD9",  // 4 — accent.primary
] as const;

const HEAT_COLORS_DARK = [
  "#2A2620",  // 0 — vazio
  "#252840",  // 1 — accent.primarySubtle dark
  "#3A4070",  // 2 — intermediário
  "#5C6CB8",  // 3 — intermediário
  "#7E8DE5",  // 4 — accent.primary dark
] as const;

const heatColors = isDark ? HEAT_COLORS_DARK : HEAT_COLORS_LIGHT;
```

**Cor do texto sobre célula** — usar `getColors(mode)` para tokens imperatives:

```ts
import { getColors } from "@/lib/design-tokens";
const colors = getColors(theme.palette.mode as "light" | "dark");

const textColor =
  heatIdx >= 3 ? colors.text.inverse   // branco (sobre célula escura)
  : heatIdx >= 1 ? colors.text.tertiary // cinza médio
  : colors.text.disabled;               // quase invisível (célula vazia)
```

**Grid layout:**

```tsx
<Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" }}>
  {Array<null>(firstWeekday).fill(null).map((_, i) => <Box key={`blank-${i}`} sx={{ aspectRatio: "1" }} />)}
  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
    <Box key={day} sx={{
      aspectRatio: "1", borderRadius: "3px", bgcolor: heatColors[heatIdx],
      cursor: hasData ? "pointer" : "default",
      "&:hover": hasData ? { opacity: 0.82, outline: "1.5px solid", outlineColor: "accent.primary" } : {},
    }} />
  ))}
</Box>
```

---

## 7. DrillDown Drawer — padrão

Componente shared para abrir lista de transações ao clicar em qualquer chart:

```tsx
const [drawerOpen, setDrawerOpen] = useState(false);
const [drawerTxs, setDrawerTxs] = useState<DrillDownTransaction[]>([]);
const [drawerLoading, startTransition] = useTransition();

function openDrawer(ids: string[], title: string) {
  setDrawerOpen(true);
  startTransition(async () => {
    const result = await getDrawerTransactionsAction(accountId, ids);
    if (result.ok) setDrawerTxs(result.data);
  });
}
```

**Chips de seção e badge de contagem no drawer:** usar `<StatusBadge variant="neutral">` — **não** `<Chip color="default" variant="outlined">`. Em dark mode, o Chip default do MUI tem contraste quebrado.

```tsx
import { StatusBadge } from "@/components/ui/StatusBadge";

// header
<StatusBadge variant="neutral">{transactions.length} transações</StatusBadge>

// coluna de seção na tabela
<StatusBadge variant="neutral">{tx.sectionName}</StatusBadge>
```

**Texto opcional/vazio:**

```tsx
// ❌ <em style={{ color: "#9e9e9e" }}>Sem descrição</em>
// ✅
<Typography component="span" variant="caption" sx={{ color: "text.disabled", fontStyle: "italic" }}>
  Sem descrição
</Typography>
```

---

## 8. KpiSparklineCard — padrão

```tsx
<KpiSparklineCard
  title="Total do Mês"
  value={formatCentsToBrl(totalBigInt)}
  color={totalBigInt >= 0n ? "success" : "error"}
  sparkline={sparklineData.totalSparkline}   // SparklinePoint[] = { label: string, value: number }[]
  currentCents={monthTotal}                  // string (BigInt serializado)
  prevCents={compValues.total}               // null = sem delta
  deltaMode={compareMode}                    // "prevMonth" | "prevYear" | "avg3m" | "none"
/>
```

**Tokens de fundo por color** — `success.50` **não existe** em MUI v6. Usar aliases corretos:

```ts
const BG_TOKEN: Record<CardColor, string> = {
  default: "background.paper",
  success: "success.light",   // = success.subtle no nosso tema
  warning: "warning.light",
  error:   "error.light",
  info:    "info.light",
};
```

A linha do sparkline usa `getChartColors(mode)[PALETTE_IDX[color]]` para manter consistência com os outros gráficos.

---

## 9. Anti-patterns

❌ **Hex hardcoded em charts**: `fill="#1565c0"`. Sempre `getChartColors(mode)` ou `theme.palette.*`.

❌ **`COUNT_TYPE_COLORS` com hex**: substituir por `theme.palette.success.main`, `theme.palette.error.main`, etc.

❌ **`onClick` no `<BarChart>`**: usa `activePayload` (undefined se clicar fora da barra). Colocar no `<Bar>` para receber os dados diretamente.

❌ **`onClick` no `content` do Treemap**: o CustomCell recebido como `content` não propaga eventos. Usar `<Treemap onClick={...}>`.

❌ **Passar BigInt para recharts/nivo**: erro em runtime. Sempre `Number(BigInt(str)) / 100`.

❌ **Somar Number e BigInt** misturados.

❌ **`@nivo` sem `next/dynamic { ssr: false }`**: erro de hidratação (D3 é browser-only).

❌ **`Box sx={{...}}` em tooltips do nivo**: renderizados fora da árvore MUI, os tokens não resolvem. Usar `style` inline.

❌ **Labels inline em `<Pie>`** (prop `label`): ficam ilegíveis. Usar `<Legend>` com `<PieLegend>`.

❌ **`Chip color="default" variant="outlined"` em dark mode**: contraste quebrado. Usar `<StatusBadge variant="neutral">`.

❌ **`success.50`, `error.50`**: não existem em MUI v6. Usar `success.light`, `error.light` (= `.subtle` no nosso tema).

❌ **Calcular delta `%` com BigInt diretamente**: divisão trunca. Usar `Number` para cálculo de porcentagem.
