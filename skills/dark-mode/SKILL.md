# SKILL — Dark Mode

## Quando usar

Sempre que criar ou alterar UI. O app suporta **light E dark** (tema "Warm Calm" em ambos), e o CLAUDE.md já exige testar nos dois. Este skill é a **disciplina** de dark mode: de onde vem a cor, como criar hierarquia sem sombra, e os erros que só aparecem no escuro.

> Fonte de tokens: [`design-system`](../design-system/SKILL.md). Cor em gráficos no escuro: [`dashboards-charts`](../dashboards-charts/SKILL.md). Movimento: [`mui-motion`](../mui-motion/SKILL.md).

---

## 1. Cor sempre por token resolvido pelo modo

Nunca escreva hex condicional na mão. O tema já tem variante dark para cada token:

```ts
import { getColors, getChartColors, type ThemeMode } from "@/lib/design-tokens";
const mode = theme.palette.mode as ThemeMode;       // "light" | "dark"
const colors = getColors(mode);                      // tokens semânticos do modo
const chartPalette = getChartColors(mode);           // paleta de chart do modo
// componentes MUI: prefira theme.palette.* (já resolve por modo)
```

❌ `color: isDark ? "#fff" : "#000"` na mão → ✅ `color: "text.primary"` (vira no modo).

---

## 2. Hierarquia por superfície, não por sombra

No escuro, **sombra quase some** — a profundidade vem de **superfície + borda** (princípio "borda > sombra" do design-system).

- Eleve com `background.paper` / `surface.subtle` + `border.subtle`, não `boxShadow`.
- `<Card>` no tema já é elevation 0 + borda (não readicionar `elevation`).
- Para destacar algo no dark, **clareie a superfície** um nível, não jogue sombra.

---

## 3. Dessaturação semântica

Cores saturadas de light "vibram" demais no fundo escuro. O tema já entrega versões dessaturadas no dark (ex.: `error.main` = terracota, não vermelho puro; `success.main` = verde-musgo). **Use os tokens semânticos** — não reaproveite o hex saturado do light.

---

## 4. Gráficos no escuro

- Cores categóricas: `getChartColors("dark")` (paleta própria do modo) — nunca a paleta light.
- `@nivo/sankey`: `linkBlendMode` `"screen"` no dark vs `"multiply"` no light; `labelTextColor` claro. Tooltips do nivo usam `style` inline (fora da árvore MUI) — ver `dashboards-charts §5`.
- Heatmap: usar `HEAT_COLORS_DARK` (gradiente do design system), não recalcular.
- Texto sobre célula/área escura: `colors.text.inverse` / `getColors(mode).text.*`.

---

## 5. Texto, contraste e assets

- Evite `#fff`/`#000` puros — use `text.primary`/`text.inverse` (o tema usa quase-preto/quase-branco calmos).
- Cheque **contraste WCAG AA nos dois modos** (texto em superfície, badge, chip). `<StatusBadge>` já resolve; `<Chip color="default" variant="outlined">` quebra contraste no dark (anti-padrão do CLAUDE.md).
- Imagens/ilustração/logo com fundo claro fixo precisam de variante ou tratamento p/ dark.

---

## 6. Resolução do modo (SSR)

- O `mode` vem do `ThemeProvider`; componentes leem via `theme.palette.mode` / `useColorScheme`.
- ❌ **Nunca** `useMediaQuery({ noSsr: true })` no ThemeProvider — causa hydration mismatch (anti-padrão do CLAUDE.md).

---

## 7. Anti-padrões

❌ Hex condicional na mão em vez de token que já vira no modo.
❌ Sombra como única fonte de hierarquia (some no dark).
❌ Reusar cor saturada do light no dark (usar token dessaturado).
❌ Paleta de chart light no dark — usar `getChartColors(mode)`.
❌ `#fff`/`#000` puros como texto.
❌ Entregar feature sem **testar visualmente nos dois modos**.
