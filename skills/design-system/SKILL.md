# SKILL — Design System "Warm Calm"

## Quando usar

**Sempre.** Qualquer componente de UI, pagina, ou estilizacao deve seguir este sistema. Nao improvise cores, tamanhos ou cantos — sempre tokens.

## Filosofia

Inspirado em **Notion, Things 3, Linear** (versao warm). Principios:

1. **Calmo > vibrante.** Cores dessaturadas, sombras quase invisiveis.
2. **Hierarquia por tipografia e espaco**, nao por cor.
3. **Cor e informacao**, nao decoracao. Verde/vermelho/mostarda so existem com significado financeiro ou status.
4. **Off-white > branco puro.** Fundos quentes descansam o olho.
5. **Bordas > sombras.** Cards tem borda sutil, nao shadow.
6. **Tokens semanticos.** Nunca hardcode `#RRGGBB` em componente.

## Stack

- **Material UI v6** com `createTheme` customizado.
- **Inter** como fonte principal (peso variavel 400/500/600/700).
- **JetBrains Mono** para valores monetarios e codigos.
- Toggle light/dark/system com persistencia via cookie + DB.

---

## Tokens

### Cores — Light Mode

```ts
{
  background: {
    canvas:    "#FAFAF7",  // fundo da pagina (off-white quente)
    surface:   "#FFFFFF",  // cards, paineis
    subtle:    "#F5F4F0",  // hover, areas secundarias
    muted:     "#EDEBE5",  // divisores suaves
  },
  border: {
    subtle:    "#E8E5DE",  // bordas de cards
    default:   "#D8D3C7",  // bordas mais visiveis
    strong:    "#B8B1A0",  // divisoes fortes
    focus:     "#4E5FD9",  // focus ring (= accent.primary)
  },
  text: {
    primary:   "#1A1815",  // titulos, valores principais
    secondary: "#4A453C",  // textos de corpo
    tertiary:  "#7A7368",  // labels, helper text
    disabled:  "#B8B1A0",
    inverse:   "#FAFAF7",  // texto sobre superficies escuras
  },
  accent: {
    primary:        "#4E5FD9",  // acoes primarias (indigo vibrante mas confortavel)
    primaryHover:   "#3D4DC4",
    primarySubtle:  "#EAEDFB",  // fundo de chips/badges info
  },
  success: {
    main:    "#4B7F52",  // entradas, OK, dentro do orcamento
    subtle:  "#E8F0E9",
  },
  warning: {
    main:    "#B8862A",  // alertas, pendentes
    subtle:  "#F5EDD5",
  },
  danger: {
    main:    "#B54545",  // saidas, deletar, excedeu
    subtle:  "#F5E4E4",
  },
  neutral: {
    main:    "#7A7368",  // informativo sem cor (= text.tertiary)
    subtle:  "#EDEBE5",
  },
}
```

### Cores — Dark Mode (Sepia Escuro)

```ts
{
  background: {
    canvas:    "#1A1815",  // carvao quente (NAO preto puro)
    surface:   "#221F1B",  // cards (mais claro = elevado)
    subtle:    "#2A2620",  // hover
    muted:     "#322D26",  // divisores
  },
  border: {
    subtle:    "#322D26",
    default:   "#44403A",
    strong:    "#5C574E",
    focus:     "#7E8DE5",
  },
  text: {
    primary:   "#F0EDE5",  // off-white quente (NAO branco puro)
    secondary: "#C4BDB0",
    tertiary:  "#8B847A",
    disabled:  "#5C574E",
    inverse:   "#1A1815",
  },
  accent: {
    primary:        "#7E8DE5",
    primaryHover:   "#94A1EC",
    primarySubtle:  "#252840",
  },
  success: {
    main:    "#7AAE83",
    subtle:  "#1F2D24",
  },
  warning: {
    main:    "#D4A551",
    subtle:  "#2E2818",
  },
  danger: {
    main:    "#D47373",
    subtle:  "#2E1F1F",
  },
  neutral: {
    main:    "#8B847A",
    subtle:  "#322D26",
  },
}
```

### Paleta de graficos

Cores dessaturadas, harmonicas, distinguiveis. Usar nesta ordem em Sankey, Treemap, multi-line, etc.

```ts
// Acessar via getChartColors(mode) — NAO hardcodar aqui
chart: {
  light: ["#4E5FD9", "#4B7F52", "#B8862A", "#B54545", "#6E8FAB", "#8B6FA8", "#C49454", "#5C8A8A"],
  dark:  ["#7E8DE5", "#7AAE83", "#D4A551", "#D47373", "#8FB0C8", "#AE96C8", "#D4AE78", "#7AADAD"],
}
```

Em dark mode, versoes levemente mais claras para manter contraste.

**Como usar:**

```ts
import { getChartColors, getColors } from "@/lib/design-tokens";
import { useTheme } from "@mui/material/styles";

const theme = useTheme();
const chartPalette = getChartColors(theme.palette.mode as "light" | "dark");
// → 8 cores no modo correto, repetir com i % 8 para mais itens

// Para tokens imperativos em SVG (nao MUI sx):
const colors = getColors(theme.palette.mode as "light" | "dark");
// → colors.text.primary, colors.text.inverse, etc.
```

### Tipografia

```ts
fontFamily: {
  sans: "var(--font-inter), 'Inter', system-ui, -apple-system, sans-serif",
  mono: "var(--font-jetbrains-mono), 'JetBrains Mono', 'Fira Code', monospace",
}

fontSize: {
  xs:   "0.75rem",    // 12px - helpers, badges
  sm:   "0.875rem",   // 14px - corpo padrao, tabelas
  base: "1rem",       // 16px - corpo, inputs
  lg:   "1.125rem",   // 18px - subtitulos
  xl:   "1.25rem",    // 20px - titulos de cards
  "2xl": "1.5rem",    // 24px - titulos de secao
  "3xl": "1.875rem",  // 30px - headings de pagina
  "4xl": "2.25rem",   // 36px - KPI numbers
  "5xl": "3rem",      // 48px - hero numbers
}

fontWeight: {
  regular: 400,
  medium:  500,
  semibold: 600,
  bold:    700,  // raro
}
```

### Espacamento (sistema 4px)

```ts
spacing: {
  1:  "4px",   // icone+texto inline
  2:  "8px",   // padding de pilulas
  3:  "12px",  // padding de inputs
  4:  "16px",  // unidade padrao (theme.spacing(4) = 16px)
  5:  "24px",  // gap entre cards / dentro de cards
  6:  "32px",  // gap entre secoes de pagina
  8:  "48px",  // blocos maiores
  10: "64px",  // hero margins
}
```

### Radius

```ts
radius: {
  sm:   "4px",    // pilulas pequenas, badges
  md:   "8px",    // inputs, botoes, chips
  lg:   "12px",   // cards, modais
  xl:   "16px",   // containers grandes
  full: "9999px", // avatares, switches
}
```

---

## Fontes — carregamento via next/font

As fontes sao carregadas em `src/app/layout.tsx` via `next/font/google` com CSS variables:

```tsx
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// No elemento html:
<html className={`${inter.variable} ${jetbrainsMono.variable}`}>
```

No tema MUI (`src/lib/design-tokens.ts`), as fontFamily referenciam os CSS vars:

```ts
fontFamily: {
  sans: "var(--font-inter), 'Inter', system-ui, ...",
  mono: "var(--font-jetbrains-mono), 'JetBrains Mono', ...",
}
```

Em `sx` para valores monetarios:

```tsx
sx={{ fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace" }}
```

---

## ThemeProvider — estrutura

```
src/app/layout.tsx             → RootLayout (Server Component)
  → le cookie "theme" e DB para initialTheme
  → <AppRouterCacheProvider>   → evita hydration mismatch Emotion/MUI
    → <AppProviders initialTheme={initialTheme}>

src/components/providers/AppProviders.tsx     → "use client"
  → <ThemeProviderClient initialMode={initialTheme}>
    → <SnackbarProvider>

src/components/providers/ThemeProviderClient.tsx  → "use client"
  → useMediaQuery sem noSsr (evita mismatch server/client)
  → resolve system → light|dark pos-hidratacao
  → <ThemeContext.Provider>
    → <MuiThemeProvider theme={lightTheme | darkTheme}>
      → <CssBaseline>
```

**Importante**: `useMediaQuery` sem `{ noSsr: true }`. Com `noSsr: true`, servidor retorna `false` e cliente retorna o valor real → hashes Emotion diferentes → hydration mismatch. Sem a opcao, servidor e primeiro render cliente concordam; troca para dark acontece pos-mount.

---

## ThemeToggle

```tsx
import { ThemeToggle } from "@/components/ThemeToggle";

// No header — cicla system → light → dark → system
<ThemeToggle />
```

Usa `ThemeContext` para ler/escrever o modo. Icone anima com `rotate(180deg)` em 320ms. Salva em cookie (SSR imediato) + DB via `saveThemeAction` (async, cross-device).

---

## Padroes de uso

### 1. Sempre tokens, nunca hex direto

```tsx
// Errado
<Box sx={{ bgcolor: "#FAFAF7", color: "#1A1815" }} />

// Certo — tokens semanticos do tema
<Box sx={{ bgcolor: "background.canvas", color: "text.primary" }} />
<Box sx={{ bgcolor: "background.surface", border: 1, borderColor: "divider" }} />
```

### 2. Card padrao

```tsx
<Box
  sx={{
    bgcolor: "background.surface",
    border: 1,
    borderColor: "border.subtle",
    borderRadius: "12px",  // radius.lg
    p: 3,                  // 24px = space.5
  }}
>
  {children}
</Box>
```

Se interativo, no hover: `borderColor: "border.default"` — sem mudar fundo.

### 3. Botoes

```tsx
<Button variant="contained">Salvar</Button>      // accent.primary
<Button variant="outlined">Cancelar</Button>     // borda apenas
<Button variant="text">Voltar</Button>           // sem borda
```

Configurado globalmente: `textTransform: none`, `borderRadius: 8px`, `disableElevation: true`, `fontWeight: 500`.

### 4. Display de valor monetario

```tsx
import { MoneyValue } from "@/components/ui/MoneyValue";

// Renderiza em JetBrains Mono com cor success/danger/neutral pelo sinal
<MoneyValue cents={amountCents} />
<MoneyValue cents={amountCents} variant="h5" />
```

Para texto inline sem o componente:

```tsx
<Typography
  component="span"
  sx={{
    fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums",
    color: cents > 0n ? "success.main" : cents < 0n ? "danger.main" : "text.tertiary",
  }}
>
  {formatCentsToBrl(cents)}
</Typography>
```

### 5. Badges de status

```tsx
import { StatusBadge } from "@/components/ui/StatusBadge";

<StatusBadge variant="success">Entrada</StatusBadge>
<StatusBadge variant="danger">Saida</StatusBadge>
<StatusBadge variant="warning">Pendente</StatusBadge>
<StatusBadge variant="neutral">Ignorado</StatusBadge>
```

Cada variant: `bgcolor: {variant}.subtle` + `color: {variant}.main`, padding `4px 8px`, borderRadius `4px`, fontSize `xs`, weight 500.

**Nao usar `<Chip color="default" variant="outlined">`** para etiquetas neutras — em dark mode o contraste fica quebrado. Sempre `<StatusBadge variant="neutral">`.

### 6. Tipografia

```tsx
<Typography variant="h1">     // 3xl, 600, tight
<Typography variant="h2">     // 2xl, 600, tight
<Typography variant="h3">     // xl, 600
<Typography variant="body1">  // base, 400
<Typography variant="body2">  // sm, 400
<Typography variant="caption"> // xs, 400, tertiary
<Typography variant="overline"> // xs, 500, uppercase, wide
<Typography variant="kpi">    // 4xl, mono, 500, tight (KPI numbers)
```

Headings ja tem `fontWeight: semibold` no tema — nao adicionar `fontWeight="bold"` redundante.

### 7. Inputs

```tsx
<TextField label="Descricao" />  // size="small" por padrao via theme
```

Configurado globalmente: border 1px `border.default`, focus 2px `border.focus`, radius `md` (8px).

### 8. Cores em SVG / recharts (fora do sx)

Para fills de celulas SVG que nao aceitam tokens MUI, usar `useTheme()`:

```tsx
const theme = useTheme();

// Cores semanticas
theme.palette.success.main   // verde-musgo
theme.palette.error.main     // terracota (= danger.main no nosso tema)
theme.palette.info.main      // indigo (= accent.primary)
theme.palette.text.secondary // labels de eixos
theme.palette.divider        // linhas de grade
theme.palette.action.hover   // cursor hover

// Paleta de series
import { getChartColors } from "@/lib/design-tokens";
const chartPalette = getChartColors(theme.palette.mode as "light" | "dark");
```

---

## Hierarquia visual

Regra: **no maximo 3 niveis de hierarquia visual em uma "tela"**. Mais que isso = baguncado.

```
1. Titulo da pagina     → text.primary, h1/h2, peso 600
2. Titulos de cards     → text.primary, h4/h5, peso 600
3. Labels e metadados   → text.tertiary, xs, peso 500, uppercase
   Valores              → text.primary, kpi/body, mono/sans
```

---

## Dark mode

- Dark mode **nao** e light com cores invertidas. E outro tema completo.
- Em dark, **texto nunca e branco puro** (`#FFF`). Sempre `#F0EDE5` (off-white quente).
- Em dark, **fundo nunca e preto puro** (`#000`). Sempre `#1A1815`.
- Saturacao levemente maior em dark (cores precisam "saltar" mais do fundo escuro).
- Testar **sempre em light E dark** antes de considerar UI pronta.

---

## Anti-patterns

- **Hardcode de cores em componentes**: `sx={{ color: "#1A1815" }}`. Sempre tokens.
- **Hardcode em SVG/recharts**: `fill="#2e7d32"`. Usar `theme.palette.*` ou `getChartColors(mode)`.
- **`Chip color="default" variant="outlined"`** para badges neutras: contraste quebrado em dark. Usar `<StatusBadge variant="neutral">`.
- **`success.50`, `error.50`**: nao existem em MUI v6. Usar `success.light`, `error.light`.
- **Misturar fontes**: nunca mais de 2 familias (Inter + JetBrains Mono).
- **Box shadows fortes**: `boxShadow: 4` raramente faz sentido. Usar borda.
- **Border radius inconsistente**: nunca `borderRadius: 7` ou `9`. Sempre dos tokens.
- **`!important`**: NUNCA.
- **`style={}` inline com cores**: sempre `sx` com tokens.
- **`noSsr: true` no `useMediaQuery` do ThemeProvider**: causa hydration mismatch Emotion.
- **`useMediaQuery` sem `AppRouterCacheProvider`**: classes Emotion divergem entre servidor e cliente.
- **`fontWeight="bold"` em headings**: ja definido no tema, redundante.

---

## Checklist antes de commitar UI

- [ ] Nenhuma cor hex hardcoded fora do `theme.ts`/`design-tokens.ts`.
- [ ] Fills SVG (recharts, SVG manual) usam `theme.palette.*` ou `getChartColors(mode)`.
- [ ] Espacamentos vem da escala (mt/mb/p/m sao numeros mapeados).
- [ ] Border radius via tokens (`md`/`lg`/etc.).
- [ ] Testado em light **E** dark mode.
- [ ] Texto financeiro usa `<MoneyValue />` ou Typography com JetBrains Mono + cor por sinal.
- [ ] Status/etiquetas usam `<StatusBadge variant="..." />`.
- [ ] Tipografia via `<Typography variant="..." />`.
- [ ] Sem `!important` e sem `style={}` inline com cores.

---

## Recursos

- **Inter**: https://fonts.google.com/specimen/Inter
- **JetBrains Mono**: https://www.jetbrains.com/lp/mono/
- **Tokens e tema**: `src/lib/design-tokens.ts`, `src/lib/theme.ts`
- **Componentes UI**: `src/components/ui/MoneyValue.tsx`, `src/components/ui/StatusBadge.tsx`, `src/components/ThemeToggle.tsx`
- **Inspiracao**: Notion, Things 3, Linear, Cron Calendar, Arc Browser
