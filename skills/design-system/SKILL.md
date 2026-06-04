# SKILL — Design System "Warm Calm"

> Sistema de design completo do MyAccountant. **Sempre consultar antes de criar ou modificar UI.** Define filosofia, tokens, layout, wrappers e especificacao detalhada de cada componente MUI permitido.

## Indice

1. [Filosofia e Stack](#1-filosofia-e-stack)
2. [Tokens](#2-tokens) — cores, tipografia, espacamento, radius
3. [Sistema de Layout](#3-sistema-de-layout) — page, section, cluster, stack, inline
4. [ThemeProvider e ThemeToggle](#4-themeprovider-e-themetoggle)
5. [Componentes Wrapper](#5-componentes-wrapper) — Section, EmptyState, KpiCard, etc.
6. [Especificacao de Componentes MUI](#6-especificacao-de-componentes-mui)
7. [Receitas de UI](#7-receitas-de-ui) — patterns recorrentes
8. [Dark Mode](#8-dark-mode)
9. [Anti-patterns](#9-anti-patterns)
10. [Checklist de PR](#10-checklist-de-pr)

---

## 1. Filosofia e Stack

### Filosofia "Warm Calm"

Inspirado em **Notion, Things 3, Linear** (versao warm). Cinco principios:

1. **Calmo > vibrante.** Cores dessaturadas, sombras quase invisiveis.
2. **Hierarquia por tipografia e espaco**, nao por cor.
3. **Cor e informacao**, nao decoracao. Verde/vermelho/mostarda so existem com significado financeiro ou status.
4. **Off-white > branco puro.** Fundos quentes descansam o olho.
5. **Bordas > sombras.** Cards tem borda sutil, nao shadow.
6. **Tokens semanticos.** Nunca hardcode `#RRGGBB` em componente.

### Stack

- **Material UI v6** com `createTheme` customizado em `src/lib/theme.ts`.
- **Inter** (sans, peso 400/500/600/700) como fonte principal.
- **JetBrains Mono** para valores monetarios e codigos.
- **Emotion** como engine de styling (default do MUI v6).
- Toggle light/dark/system com persistencia (cookie + DB).

---

## 2. Tokens

Todos os tokens estao em `src/lib/design-tokens.ts` e aplicados ao tema MUI em `src/lib/theme.ts`. **Sempre referenciar via tokens semanticos**, nunca via hex direto.

### 2.1 Cores — Light Mode

```ts
background: {
  canvas:    "#FAFAF7",  // fundo da pagina (off-white quente)
  surface:   "#FFFFFF",  // cards, paineis
  subtle:    "#F5F4F0",  // hover, areas secundarias
  muted:     "#EDEBE5",  // divisores
}
border: {
  subtle:  "#E8E5DE",   // bordas de cards
  default: "#D8D3C7",   // bordas mais visiveis
  strong:  "#B8B1A0",
  focus:   "#4E5FD9",
}
text: {
  primary:   "#1A1815",
  secondary: "#4A453C",
  tertiary:  "#7A7368",
  disabled:  "#B8B1A0",
  inverse:   "#FAFAF7",
}
accent:  { primary: "#4E5FD9", primaryHover: "#3D4DC4", primarySubtle: "#EAEDFB" }
success: { main: "#4B7F52", subtle: "#E8F0E9" }
warning: { main: "#B8862A", subtle: "#F5EDD5" }
danger:  { main: "#B54545", subtle: "#F5E4E4" }
neutral: { main: "#7A7368", subtle: "#EDEBE5" }
```

### 2.2 Cores — Dark Mode (Sepia Escuro)

```ts
background: {
  canvas:  "#1A1815",   // carvao quente, NAO preto puro
  surface: "#221F1B",   // cards (mais claro = elevado)
  subtle:  "#2A2620",
  muted:   "#322D26",
}
text: {
  primary:   "#F0EDE5",  // off-white quente, NAO branco puro
  secondary: "#C4BDB0",
  tertiary:  "#8B847A",
}
accent:  { primary: "#7E8DE5", primaryHover: "#94A1EC", primarySubtle: "#252840" }
success: { main: "#7AAE83", subtle: "#1F2D24" }
warning: { main: "#D4A551", subtle: "#2E2818" }
danger:  { main: "#D47373", subtle: "#2E1F1F" }
neutral: { main: "#8B847A", subtle: "#322D26" }
```

### 2.3 Paleta de graficos

```ts
chart: {
  light: ["#4E5FD9", "#4B7F52", "#B8862A", "#B54545", "#6E8FAB", "#8B6FA8", "#C49454", "#5C8A8A"],
  dark:  ["#7E8DE5", "#7AAE83", "#D4A551", "#D47373", "#8FB0C8", "#AE96C8", "#D4AE78", "#7AADAD"],
}
```

Uso em recharts/SVG:
```tsx
import { getChartColors } from "@/lib/design-tokens";
const palette = getChartColors(theme.palette.mode as "light" | "dark");
// palette[i % 8] para series infinitas
```

### 2.4 Tipografia

```ts
fontFamily: {
  sans: "var(--font-inter), 'Inter', system-ui, sans-serif",
  mono: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
}

fontSize:
  xs    0.75rem  (12px)  helpers, badges, captions
  sm    0.875rem (14px)  corpo padrao, tabelas
  base  1rem     (16px)  corpo, inputs
  lg    1.125rem (18px)  subtitulos
  xl    1.25rem  (20px)  titulos de cards (h4)
  2xl   1.5rem   (24px)  titulos de secao (h2/h3)
  3xl   1.875rem (30px)  headings de pagina (h1)
  4xl   2.25rem  (36px)  KPI numbers
  5xl   3rem     (48px)  hero numbers

fontWeight: regular 400, medium 500, semibold 600, bold 700
```

### 2.5 Espacamento base (sistema 4px)

`theme.spacing(1)` = 4px. Em `sx={{ p: 4 }}` = 16px. Sempre usar via escala, **nunca px direto**.

```
1 = 4px    2 = 8px    3 = 12px    4 = 16px (★ comum)
5 = 24px   6 = 32px   8 = 48px   10 = 64px
```

### 2.6 Radius

```
none 0    sm 4    md 8 (★ inputs/botoes)
lg 12 (★ cards/modais)    xl 16    full 9999
```

---

## 3. Sistema de Layout

Tokens **semanticos** para espacamento. Importar de `@/lib/design-tokens`:

```ts
import { layout } from "@/lib/design-tokens";
```

| Token | Valor | Quando usar |
|---|---|---|
| `layout.page` | 8 (32px) | Padding interno de pagina (em `<main>` ou Container) |
| `layout.section` | 12 (48px) | Gap vertical entre secoes principais de uma pagina |
| `layout.cluster` | 6 (24px) | Gap entre cards/itens relacionados em um grupo |
| `layout.card` | 6 (24px) | Padding interno de Cards |
| `layout.stack` | 4 (16px) | Stack vertical padrao entre elementos relacionados |
| `layout.inline` | 2 (8px) | Gap inline (icone+texto, botoes lado a lado) |
| `layout.micro` | 1 (4px) | Detalhes muito proximos (label sobre valor, raro) |

### 3.1 Anatomia de uma pagina

```
┌──────────────────────────────────────────────────────┐  ← <main> com p: layout.page
│  PageHeader (titulo + acoes)                        │
│                                                      │  ← mb: layout.section (no PageHeader)
│  ─────────────────────────────────────────────────  │
│  Section: "Resumo"                                  │
│    ┌──────┐ ┌──────┐ ┌──────┐                       │  ← Grid com spacing={layout.cluster}
│    │ KPI  │ │ KPI  │ │ KPI  │                       │
│    └──────┘ └──────┘ └──────┘                       │
│                                                      │  ← Stack spacing={layout.section}
│  Section: "Transacoes do mes"                       │
│    [tabela ou lista]                                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 3.2 Receitas de layout

**Pagina padrao:**
```tsx
import { Container, Stack } from "@mui/material";
import { layout } from "@/lib/design-tokens";

<Container maxWidth="lg" sx={{ py: layout.page }}>
  <PageHeader title="Transacoes" actions={...} />

  <Stack spacing={layout.section}>
    <Section title="Resumo">...</Section>
    <Section title="Lista">...</Section>
  </Stack>
</Container>
```

**Grid de cards (responsive):**
```tsx
<Grid container spacing={layout.cluster}>
  <Grid item xs={12} sm={6} md={4}>
    <KpiCard label="..." value={...} />
  </Grid>
  <Grid item xs={12} sm={6} md={4}>
    <KpiCard label="..." value={...} />
  </Grid>
</Grid>
```

**Form vertical:**
```tsx
<Stack spacing={layout.stack}>
  <TextField label="Descricao" />
  <TextField label="Valor" />
  <DatePicker label="Data" />
  <Stack direction="row" spacing={layout.inline} justifyContent="flex-end">
    <Button variant="text" onClick={onCancel}>Cancelar</Button>
    <Button variant="contained" onClick={onSubmit}>Salvar</Button>
  </Stack>
</Stack>
```

**Inline (icone + texto):**
```tsx
<Stack direction="row" spacing={layout.inline} alignItems="center">
  <CheckIcon fontSize="small" sx={{ color: "success.main" }} />
  <Typography variant="body2">Pago</Typography>
</Stack>
```

### 3.3 Container max-widths

Importar de `@/lib/design-tokens`:

```
containers.xs  480px   forms estreitos, dialogs xs
containers.sm  640px   conteudo de leitura, dialog padrao
containers.md  960px   conteudo de pagina padrao
containers.lg  1280px  dashboards, listagens (★ padrao)
containers.xl  1440px  conteudo muito amplo
```

Usar com Container do MUI:
```tsx
<Container maxWidth="lg">  // = containers.lg
```

---

## 4. ThemeProvider e ThemeToggle

### Estrutura

```
src/app/layout.tsx                              → Server Component
  → le cookie "theme" e DB para initialTheme
  → <AppRouterCacheProvider>                    → evita hydration mismatch
    → <AppProviders initialTheme={initialTheme}>

src/components/providers/AppProviders.tsx       → "use client"
  → <ThemeProviderClient initialMode={initialTheme}>
    → <SnackbarProvider>

src/components/providers/ThemeProviderClient.tsx → "use client"
  → useMediaQuery sem noSsr (evita mismatch server/client)
  → resolve system → light|dark pos-hidratacao
  → <ThemeContext.Provider>
    → <MuiThemeProvider theme={lightTheme | darkTheme}>
      → <CssBaseline>
```

### Toggle

```tsx
import { ThemeToggle } from "@/components/ThemeToggle";

<ThemeToggle />  // cicla system → light → dark → system
```

Persistencia dupla: cookie (SSR imediato) + DB via `saveThemeAction` (cross-device async).

### Cuidados criticos

- `useMediaQuery` **sem `{ noSsr: true }`**. Com `noSsr: true`, servidor retorna `false` e cliente retorna o valor real → hashes Emotion diferentes → hydration mismatch.
- Sempre via `AppRouterCacheProvider` no layout raiz.

---

## 5. Componentes Wrapper

Wrappers custom em `src/components/ui/` que encapsulam patterns comuns. **Use sempre estes em vez de construir do zero.**

### 5.1 `<PageHeader />`

Cabecalho padronizado de pagina (breadcrumbs + titulo + descricao + acoes).

```tsx
import { PageHeader } from "@/components/ui/PageHeader";

<PageHeader
  title="Transacoes"
  description="Visualize e gerencie todas as transacoes"
  breadcrumbs={[
    { label: "Home", href: "/" },
    { label: "Transacoes" },
  ]}
  actions={
    <>
      <Button variant="outlined">Importar CSV</Button>
      <Button variant="contained">Nova transacao</Button>
    </>
  }
/>
```

Layout interno: breadcrumbs em cima, titulo h1 + descricao a esquerda, acoes a direita. Em mobile, acoes empilham abaixo do titulo. `mb: layout.section` aplicado automaticamente.

### 5.2 `<Section />`

Bloco logico dentro de uma pagina, com cabecalho consistente.

```tsx
import { Section } from "@/components/ui/Section";

<Section
  title="Receitas"
  description="Entradas do mes"
  action={<Button size="small">Adicionar</Button>}
>
  <Grid container spacing={layout.cluster}>
    {/* conteudo */}
  </Grid>
</Section>
```

Para multiplas secoes na mesma pagina, envolver em `<Stack spacing={layout.section}>`.

### 5.3 `<EmptyState />`

Estado vazio padronizado (icone + titulo + descricao + acao opcional).

```tsx
import { EmptyState } from "@/components/ui/EmptyState";
import InboxIcon from "@mui/icons-material/Inbox";

<EmptyState
  icon={<InboxIcon sx={{ fontSize: 48 }} />}
  title="Nenhuma transacao ainda"
  description="Comece criando sua primeira transacao para acompanhar suas financas."
  action={<Button variant="contained">Criar transacao</Button>}
/>
```

`size="compact"` para uso dentro de cards/tabs (menos padding).

### 5.4 `<KpiCard />`

Card de KPI com valor, delta vs periodo, sparkline opcional.

```tsx
import { KpiCard } from "@/components/ui/KpiCard";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

<KpiCard
  label="Total do mes"
  value={123456n}  // BigInt centavos, formatado automaticamente como R$ 1.234,56
  delta={{
    value: 12.5,
    period: "vs mes anterior",
    intent: "negative-is-good",  // para gastos: queda e bom
  }}
  sparkline={[100, 120, 115, 130, 125, 140]}
  icon={<TrendingUpIcon fontSize="small" />}
  hint="Inclui transacoes pendentes"
  loading={false}
/>
```

`intent` controla cores do delta:
- `"positive-is-good"` (default): aumento verde, queda vermelha
- `"negative-is-good"`: aumento vermelho, queda verde (uso: gastos)
- `"neutral"`: sempre cinza

### 5.5 `<DialogShell />`

Dialog padronizado com header (titulo + close), body com scroll, e actions.

```tsx
import { DialogShell } from "@/components/ui/DialogShell";

<DialogShell
  open={open}
  onClose={onClose}
  title="Confirmar exclusao"
  description="Esta acao nao pode ser desfeita."
  maxWidth="sm"
  actions={
    <>
      <Button variant="text" onClick={onClose}>Cancelar</Button>
      <Button variant="contained" color="error" onClick={handleDelete}>
        Excluir
      </Button>
    </>
  }
>
  <Typography variant="body2">
    Voce esta prestes a excluir a transacao "Compra no mercado".
  </Typography>
</DialogShell>
```

Comportamento: fullscreen em mobile (override com `fullScreenOnMobile={false}`), botao X no header, actions empilhadas em mobile.

**Use sempre DialogShell**, nunca `<Dialog>` cru do MUI.

### 5.6 `<MoneyValue />`

Valor monetario em JetBrains Mono com cor por sinal.

```tsx
import { MoneyValue } from "@/components/ui/MoneyValue";

<MoneyValue cents={amountCents} />
<MoneyValue cents={amountCents} variant="h5" />
```

### 5.7 `<StatusBadge />`

Etiqueta de status financeiro.

```tsx
import { StatusBadge } from "@/components/ui/StatusBadge";

<StatusBadge variant="success">Entrada</StatusBadge>
<StatusBadge variant="danger">Saida</StatusBadge>
<StatusBadge variant="warning">Pendente</StatusBadge>
<StatusBadge variant="neutral">Ignorado</StatusBadge>
```

### 5.8 `<ExpandableIconButton />`

Botao icone que revela texto no hover.

```tsx
import { ExpandableIconButton } from "@/components/ui/ExpandableIconButton";

<ExpandableIconButton
  icon={<ClearIcon sx={{ fontSize: 15 }} />}
  label="Limpar tudo"
  onClick={handleClear}
/>
```

Usar para acoes **secundarias** apenas. Label curto (2-3 palavras). Cor padrao `text.tertiary` → `text.secondary` no hover.

---

## 6. Especificacao de Componentes MUI

Para cada componente MUI: anatomia, variants permitidas, codigo de referencia, antipatterns. **Toda customizacao ja esta no tema** — voce nao precisa redefinir cores/radius/padding na maioria dos casos.

### 6.1 Surfaces

#### `<Card />`

Container basico com fundo, borda sutil e radius.

```tsx
<Card>
  <CardContent>
    {/* conteudo. Padding ja vem do tema: layout.card (24px) */}
  </CardContent>
</Card>
```

**Variants permitidas:** apenas o default. **Sem `elevation`** maior que 0 (tema forca 0 + borda).

**Card com header opcional:**
```tsx
<Card>
  <CardHeader
    title="Detalhes da transacao"
    titleTypographyProps={{ variant: "h4" }}
  />
  <CardContent>...</CardContent>
</Card>
```

**Card interativo (clicavel):**
```tsx
<Card
  sx={{
    cursor: "pointer",
    transition: "border-color 120ms",
    "&:hover": { borderColor: "border.default" },
  }}
>
  <CardActionArea>...</CardActionArea>
</Card>
```

**Anti-pattern:** `elevation={4}`, `boxShadow` forte, fundo colorido (`bgcolor: "primary.main"`).

---

#### `<Paper />`

Use **somente** em casos onde Card nao se aplica (ex: container de Popover, contraste interno). Default elevation 0 ja configurado.

```tsx
<Paper variant="outlined">  // borda sutil, sem sombra
  {/* conteudo */}
</Paper>
```

**Anti-pattern:** Paper com elevation > 0 dentro de outro Paper. Hierarquia visual quebra.

---

### 6.2 Buttons

#### `<Button />`

Configurado no tema: `borderRadius: 8px`, `textTransform: none`, `disableElevation: true`, `fontWeight: 500`.

**Variants permitidas:**
- `contained` — acao primaria. Apenas **uma** por tela.
- `outlined` — acao secundaria.
- `text` — acao terciaria (links de acao, "Cancelar" em forms).

```tsx
<Button variant="contained">Salvar</Button>        // accent.primary
<Button variant="outlined">Importar</Button>       // borda apenas
<Button variant="text">Cancelar</Button>           // sem borda

// Com icone
<Button variant="contained" startIcon={<AddIcon />}>
  Nova transacao
</Button>

// Loading
<Button variant="contained" disabled={loading}>
  {loading ? <CircularProgress size={20} /> : "Salvar"}
</Button>

// Destrutivo (cor de perigo)
<Button variant="contained" color="error">Excluir</Button>
```

**Sizes:** `small`, `medium` (default), `large`. **Use `medium` por padrao**, `small` em barras de tabela/toolbar densa, `large` apenas em CTAs hero.

**Anti-pattern:**
- 2+ botoes `contained` lado a lado (hierarquia confusa).
- `color="secondary"` em buttons (nao configurado no tema, fica padrao MUI).
- `Button` para navegar entre paginas — use `Link` ou `<Button component={NextLink}>`.

---

#### `<IconButton />`

Botao circular so com icone.

```tsx
<IconButton
  size="small"
  aria-label="Editar"
  onClick={handleEdit}
>
  <EditIcon fontSize="small" />
</IconButton>
```

**Sempre** com `aria-label`. **Sempre** `size="small"` para uso em tabelas/toolbars; `medium` (default) em headers; `large` raro.

**Cor:** padrao `text.tertiary`, hover `text.primary`. Para destacar, `color="error"` ou `color="primary"`.

**Anti-pattern:** IconButton sem aria-label (problema de acessibilidade).

---

#### `<ButtonGroup />`

Grupo de botoes relacionados (raro). Prefira `<Stack direction="row">` com botoes individuais quase sempre.

```tsx
<ButtonGroup variant="outlined" size="small">
  <Button>Diario</Button>
  <Button>Semanal</Button>
  <Button>Mensal</Button>
</ButtonGroup>
```

**Quando usar:** filtros de granularidade temporal, seletor mes/ano/total.
**Quando NAO usar:** acoes diferentes (salvar/cancelar). Use Stack.

---

#### `<ToggleButtonGroup />` + `<ToggleButton />`

Para selecao exclusiva entre 2-4 opcoes visualmente equivalentes.

```tsx
<ToggleButtonGroup
  value={view}
  exclusive
  onChange={(_, v) => v && setView(v)}
  size="small"
>
  <ToggleButton value="list">Lista</ToggleButton>
  <ToggleButton value="grid">Grade</ToggleButton>
</ToggleButtonGroup>
```

**Anti-pattern:** mais de 4 opcoes (use Select). Misturar com texto/icone inconsistente.

---

#### `<Fab />` (Floating Action Button)

**Nao usar.** Nao se encaixa no estilo warm calm minimalista. Para acao primaria em pagina, use Button no PageHeader.

---

### 6.3 Inputs

#### `<TextField />`

Configurado no tema: `size="small"`, `variant="outlined"`, radius `md` (8px), border `default` → `focus` no estado focado.

```tsx
<TextField
  label="Descricao"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  helperText="Maximo 100 caracteres"
  error={!!error}
  fullWidth
/>
```

**Em form com React Hook Form:**
```tsx
<Controller
  name="description"
  control={control}
  render={({ field, fieldState }) => (
    <TextField
      {...field}
      label="Descricao"
      error={!!fieldState.error}
      helperText={fieldState.error?.message}
      fullWidth
    />
  )}
/>
```

**Multiline:**
```tsx
<TextField label="Notas" multiline minRows={3} maxRows={6} fullWidth />
```

**Numerico (input de centavos via NumericFormat — ver `money-handling`):**
```tsx
<NumericFormat
  customInput={TextField}
  thousandSeparator="."
  decimalSeparator=","
  prefix="R$ "
  decimalScale={2}
  fixedDecimalScale
  label="Valor"
  fullWidth
/>
```

**Anti-pattern:**
- `variant="filled"` ou `"standard"` (tema configura outlined).
- `size="medium"` (use o default small).
- `fullWidth={false}` em forms (sempre fullWidth dentro de Stack).

---

#### `<Select />`

Para listas com ate ~8 opcoes. Acima disso, use Autocomplete.

```tsx
<FormControl size="small" fullWidth>
  <InputLabel>Categoria</InputLabel>
  <Select value={category} onChange={(e) => setCategory(e.target.value)} label="Categoria">
    <MenuItem value="">
      <em>Nenhuma</em>
    </MenuItem>
    <MenuItem value="food">Alimentacao</MenuItem>
    <MenuItem value="transport">Transporte</MenuItem>
  </Select>
</FormControl>
```

**Anti-pattern:** Select sem label visivel. Select com 20+ opcoes (use Autocomplete).

---

#### `<Autocomplete />`

Para listas longas (8+ opcoes), busca, multi-select, free input.

```tsx
<Autocomplete
  options={categories}
  getOptionLabel={(opt) => opt.name}
  value={selected}
  onChange={(_, v) => setSelected(v)}
  renderInput={(params) => (
    <TextField {...params} label="Categoria" />
  )}
  size="small"
  fullWidth
/>
```

**Multi-select com chips:**
```tsx
<Autocomplete
  multiple
  options={tags}
  getOptionLabel={(opt) => opt.name}
  renderTags={(value, getTagProps) =>
    value.map((option, index) => (
      <Chip
        {...getTagProps({ index })}
        key={option.id}
        label={option.name}
        size="small"
      />
    ))
  }
  renderInput={(params) => <TextField {...params} label="Tags" />}
/>
```

**Free input (cria valores novos):**
```tsx
<Autocomplete
  freeSolo
  options={existingInstitutions}
  renderInput={(params) => <TextField {...params} label="Instituicao" />}
/>
```

---

#### `<Checkbox />` + `<FormControlLabel />`

```tsx
<FormControlLabel
  control={<Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} />}
  label="Marcar como pago"
/>
```

**Lista de checkboxes (multi-select):**
```tsx
<FormGroup>
  <FormControlLabel control={<Checkbox />} label="Email" />
  <FormControlLabel control={<Checkbox />} label="SMS" />
  <FormControlLabel control={<Checkbox />} label="Push" />
</FormGroup>
```

**Anti-pattern:** Checkbox sem label (a menos que esteja em coluna de tabela com header descritivo).

---

#### `<Radio />` + `<RadioGroup />`

Selecao exclusiva entre 2-5 opcoes textuais.

```tsx
<FormControl>
  <FormLabel>Periodo</FormLabel>
  <RadioGroup value={period} onChange={(e) => setPeriod(e.target.value)}>
    <FormControlLabel value="monthly" control={<Radio />} label="Mensal" />
    <FormControlLabel value="yearly" control={<Radio />} label="Anual" />
  </RadioGroup>
</FormControl>
```

Para 2-4 opcoes visuais equivalentes (lista/grade), prefira `<ToggleButtonGroup>`.

---

#### `<Switch />`

Para configuracoes boolean instantaneas (sem botao salvar).

```tsx
<FormControlLabel
  control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
  label="Notificacoes por email"
/>
```

**Anti-pattern:** Switch dentro de form que precisa de "Salvar" — use Checkbox.

---

#### `<Slider />`

Para selecionar valor numerico em range. Uso raro neste projeto.

```tsx
<Slider
  value={budget}
  onChange={(_, v) => setBudget(v as number)}
  min={0}
  max={10000}
  step={100}
  valueLabelDisplay="auto"
  valueLabelFormat={(v) => formatCentsToBrl(BigInt(v * 100))}
/>
```

**Quando usar:** what-if scenarios em dashboards, ajustes de budget.

---

### 6.4 Pickers

#### `<DatePicker />` (de `@mui/x-date-pickers`)

```tsx
<DatePicker
  label="Data"
  value={date}
  onChange={(d) => setDate(d)}
  format="dd/MM/yyyy"
  slotProps={{ textField: { size: "small", fullWidth: true } }}
/>
```

Requer `<LocalizationProvider dateAdapter={AdapterDateFnsV3} adapterLocale={ptBR}>` no root layout.

Ver `skills/date-timezone/SKILL.md` para regras de formato e timezone.

---

#### `<DateRangePicker />`

Para filtros de periodo em dashboards. Mesma estrutura do DatePicker. Padrao: presets `("Este mes", "Mes anterior", "Ultimos 3 meses")` ao lado do calendario.

---

### 6.5 Feedback

#### `<Alert />`

Mensagem inline (nao bloqueante) sobre algo importante.

```tsx
<Alert severity="success">Transacao salva com sucesso</Alert>
<Alert severity="warning">Voce esta proximo do orcamento mensal</Alert>
<Alert severity="error">Falha ao salvar. Tente novamente.</Alert>
<Alert severity="info">Importacao em andamento, pode demorar alguns minutos.</Alert>
```

Configurado no tema com `border: 1px solid` + `bgcolor: {sev}.subtle` + `color: {sev}.main`.

**Com acao:**
```tsx
<Alert severity="warning" action={<Button size="small">Atualizar</Button>}>
  Sua sessao vai expirar em breve
</Alert>
```

**Anti-pattern:** Alert para erros de campo de form (use `helperText` do TextField).

---

#### `<Snackbar />` (via notistack)

Toast nao bloqueante. **Use sempre `notistack`** (configurado em `AppProviders`).

```tsx
import { useSnackbar } from "notistack";

const { enqueueSnackbar } = useSnackbar();

// Sucesso
enqueueSnackbar("Transacao salva", { variant: "success" });

// Erro
enqueueSnackbar("Falha ao salvar", { variant: "error" });

// Com acao (desfazer)
enqueueSnackbar("Transacao excluida", {
  variant: "default",
  action: (key) => (
    <Button color="inherit" size="small" onClick={() => undoDelete(key)}>
      Desfazer
    </Button>
  ),
});
```

**Auto-dismiss:** 4s por padrao para sucesso/info, 6s para warning, manual close para error.

**Anti-pattern:** Snackbar para informacao critica (use Dialog ou Alert).

---

#### `<Dialog />` → use `<DialogShell />`

**Nunca usar `Dialog` cru.** Use `DialogShell` (secao 5.5) que ja aplica todos os padroes.

---

#### `<Tooltip />`

Hint discreto no hover de elemento.

```tsx
<Tooltip title="Editar transacao">
  <IconButton size="small"><EditIcon /></IconButton>
</Tooltip>
```

**Sempre** texto curto (< 10 palavras). Configurado no tema com fundo `text.primary` + texto `text.inverse`.

**Anti-pattern:**
- Tooltip em conteudo critico (info importante deve estar visivel).
- Texto longo (use Popover).
- Tooltip em elemento touch-only (mobile nao tem hover).

---

#### `<Popover />`

Conteudo flutuante mais complexo que Tooltip (com interacoes).

```tsx
const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

<IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
  <InfoIcon />
</IconButton>
<Popover
  open={!!anchorEl}
  anchorEl={anchorEl}
  onClose={() => setAnchorEl(null)}
  anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
>
  <Box sx={{ p: layout.card, maxWidth: 320 }}>
    <Typography variant="body2">
      Conteudo do popover com mais detalhes...
    </Typography>
  </Box>
</Popover>
```

---

#### `<Skeleton />`

Placeholder de carregamento.

```tsx
{loading ? (
  <Stack spacing={layout.stack}>
    <Skeleton variant="text" width="40%" />
    <Skeleton variant="rectangular" height={120} />
    <Skeleton variant="text" />
  </Stack>
) : (
  <RealContent />
)}
```

**Variants:** `text`, `rectangular`, `circular`. Width/height respeitam o conteudo real para evitar layout shift.

**Anti-pattern:** Spinner generico (`CircularProgress` em pagina inteira) quando Skeleton seria possivel.

---

#### `<CircularProgress />` e `<LinearProgress />`

Para loading bloqueante ou indeterminado (upload, import).

```tsx
<CircularProgress size={20} />        // dentro de botoes
<LinearProgress />                    // topo de pagina, indeterminado
<LinearProgress variant="determinate" value={65} />   // com %
```

---

### 6.6 Navigation

#### `<Tabs />` + `<Tab />`

Para alternar entre seccoes na mesma pagina (sem mudar URL ou com query param).

```tsx
const [tab, setTab] = useState(0);

<Box sx={{ borderBottom: 1, borderColor: "border.subtle" }}>
  <Tabs value={tab} onChange={(_, v) => setTab(v)}>
    <Tab label="Resumo" />
    <Tab label="Transacoes" />
    <Tab label="Categorias" />
  </Tabs>
</Box>

{tab === 0 && <SummaryView />}
{tab === 1 && <TransactionsView />}
{tab === 2 && <CategoriesView />}
```

Configurado: indicator `accent.primary` 2px, tab inativo `text.tertiary`, ativo `text.primary`, peso 500.

**Com icones:**
```tsx
<Tab icon={<DashboardIcon />} iconPosition="start" label="Dashboard" />
```

**Anti-pattern:**
- Mais de 5 tabs (use Tabs verticais ou navegacao real).
- Tabs para conteudo que merece URL propria (use Next routing).

---

#### `<Breadcrumbs />` → use `<PageHeader breadcrumbs={...} />`

Use sempre via PageHeader, nao direto.

---

#### `<Pagination />`

Para listagens paginadas.

```tsx
<Pagination
  count={totalPages}
  page={currentPage}
  onChange={(_, p) => setCurrentPage(p)}
  size="small"
  shape="rounded"
/>
```

Para listas longas com filtros, **prefira virtual scrolling ou "carregar mais"** sobre paginas numeradas.

---

#### `<Menu />` + `<MenuItem />`

Lista de acoes contextuais (botao "..." em linha de tabela).

```tsx
const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

<IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
  <MoreVertIcon />
</IconButton>
<Menu
  anchorEl={anchorEl}
  open={!!anchorEl}
  onClose={() => setAnchorEl(null)}
  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
  transformOrigin={{ vertical: "top", horizontal: "right" }}
>
  <MenuItem onClick={handleEdit}>
    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
    <ListItemText>Editar</ListItemText>
  </MenuItem>
  <Divider />
  <MenuItem onClick={handleDelete} sx={{ color: "danger.main" }}>
    <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: "danger.main" }} /></ListItemIcon>
    <ListItemText>Excluir</ListItemText>
  </MenuItem>
</Menu>
```

**Ordem:** acoes positivas primeiro, destrutivas depois (com Divider entre).

---

#### `<Drawer />`

Painel lateral para conteudo secundario (filtros, detalhe, edicao).

```tsx
<Drawer
  anchor="right"
  open={open}
  onClose={onClose}
  PaperProps={{
    sx: { width: { xs: "100%", sm: 480 } },
  }}
>
  <Box sx={{ p: layout.card }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: layout.cluster }}>
      <Typography variant="h3">Detalhes</Typography>
      <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
    </Stack>
    {/* conteudo */}
  </Box>
</Drawer>
```

**Widths recomendadas:**
- `xs/sm`: `480px` (detalhes, filtros)
- `md`: `640px` (formularios extensos)
- mobile: sempre `100%`

**Anti-pattern:** Drawer com conteudo critico que deveria ser uma pagina propria.

---

#### `<Stepper />`

Para processos multi-etapa (import CSV com mapping, onboarding).

```tsx
<Stepper activeStep={step} alternativeLabel>
  <Step><StepLabel>Upload</StepLabel></Step>
  <Step><StepLabel>Mapear colunas</StepLabel></Step>
  <Step><StepLabel>Confirmar</StepLabel></Step>
</Stepper>
```

**Vertical** para passos com muito conteudo cada:
```tsx
<Stepper activeStep={step} orientation="vertical">
  <Step><StepLabel>Upload</StepLabel><StepContent>...</StepContent></Step>
</Stepper>
```

---

### 6.7 Data Display

#### `<Table />`

```tsx
<TableContainer>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Data</TableCell>
        <TableCell>Descricao</TableCell>
        <TableCell align="right">Valor</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {transactions.map((tx) => (
        <TableRow key={tx.id} hover>
          <TableCell>{format(tx.date, "dd/MM/yyyy")}</TableCell>
          <TableCell>{tx.description}</TableCell>
          <TableCell align="right">
            <MoneyValue cents={tx.amountCents} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

Configurado no tema: borda `border.subtle`, header maiusculo pequeno `text.tertiary`, hover linha `background.subtle`.

**Alinhamento:**
- Datas: left
- Texto: left
- Numeros (valor, %): **right** (alinha decimais)
- Acoes: right

**Anti-pattern:**
- Tabela com `<Paper elevation={4}>` ao redor.
- Misturar com `<DataGrid>` na mesma tela (escolha um padrao).

---

#### `<DataGrid />` (de `@mui/x-data-grid`)

Para tabelas com **5.000+ linhas**, sort/filter/virtualizacao automaticos. Para listas menores, prefira Table.

**Configurar com tokens:**
```tsx
<DataGrid
  rows={rows}
  columns={cols}
  sx={{
    border: 1,
    borderColor: "border.subtle",
    borderRadius: "12px",
    "& .MuiDataGrid-columnHeaders": {
      bgcolor: "background.subtle",
    },
  }}
  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
/>
```

---

#### `<List />` + `<ListItem />`

Para listas de itens nao tabulares (menus, settings).

```tsx
<List>
  <ListItem disablePadding>
    <ListItemButton onClick={handleClick}>
      <ListItemIcon><InboxIcon /></ListItemIcon>
      <ListItemText primary="Inbox" secondary="3 nao lidas" />
    </ListItemButton>
  </ListItem>
</List>
```

---

#### `<Avatar />`

```tsx
<Avatar alt={user.name} src={user.photoUrl} />
<Avatar>{user.name.charAt(0).toUpperCase()}</Avatar>  // fallback iniciais
```

**Sizes:** `width: 32, height: 32` (small, listas), `40` (default), `64` (perfil), `96+` (settings).

**AvatarGroup** para multiplos:
```tsx
<AvatarGroup max={3}>
  {members.map(m => <Avatar key={m.id}>{m.name[0]}</Avatar>)}
</AvatarGroup>
```

---

#### `<Chip />`

Etiqueta compacta. **Para status, use `<StatusBadge>` (5.7).** Para tags genericas, Chip e ok.

```tsx
<Chip label="Recorrente" size="small" />
<Chip label="Recorrente" size="small" onDelete={handleDelete} />
```

**Anti-pattern:** `<Chip color="default" variant="outlined">` para badges neutros — contraste quebra em dark. Use `StatusBadge variant="neutral"`.

---

#### `<Badge />`

Notificacao numerica em outro elemento.

```tsx
<Badge badgeContent={4} color="error">
  <NotificationsIcon />
</Badge>

<Badge variant="dot" color="error">
  <MailIcon />
</Badge>
```

---

#### `<Accordion />`

Conteudo expansivel. Use para FAQs, settings avancados, detalhes secundarios.

```tsx
<Accordion>
  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
    <Typography>Detalhes avancados</Typography>
  </AccordionSummary>
  <AccordionDetails>
    {/* conteudo */}
  </AccordionDetails>
</Accordion>
```

**Configurar para usar borda em vez de sombra:**
```tsx
<Accordion
  disableGutters
  elevation={0}
  sx={{
    border: 1,
    borderColor: "border.subtle",
    borderRadius: "12px !important",
    "&:before": { display: "none" },  // remove linha default
  }}
>
```

(O `!important` aqui e excecao necessaria pelo override do MUI; alternativa: configurar no tema globalmente.)

**Anti-pattern:** Accordion para conteudo principal da pagina (sempre visivel deve ser default).

---

#### `<Divider />`

Linha separadora.

```tsx
<Divider />                                // horizontal full-width
<Divider sx={{ my: layout.cluster }} />    // com espaco
<Divider orientation="vertical" flexItem />  // vertical em Stack horizontal
<Divider><Chip label="ou" size="small" /></Divider>  // com texto centrado
```

---

### 6.8 Layout (MUI)

#### `<Stack />`

Container flex para empilhar elementos. **Use sempre** em vez de `<Box display="flex">`.

```tsx
<Stack spacing={layout.stack}>           {/* vertical */}
<Stack direction="row" spacing={layout.inline}>  {/* horizontal */}
<Stack direction={{ xs: "column", sm: "row" }}>  {/* responsivo */}
```

---

#### `<Grid />` (v2)

Para layouts 2D responsivos.

```tsx
import { Grid } from "@mui/material";

<Grid container spacing={layout.cluster}>
  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
    <KpiCard ... />
  </Grid>
  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
    <KpiCard ... />
  </Grid>
</Grid>
```

**Anti-pattern:** Grid para layouts simples (use Stack).

---

#### `<Container />`

Limitador de largura maxima centralizado.

```tsx
<Container maxWidth="lg" sx={{ py: layout.page }}>
  {/* conteudo */}
</Container>
```

**Use no nivel da pagina**, nao dentro de cards.

---

#### `<Box />`

Generico. Use **somente** quando Stack/Grid/Container nao se aplicam.

---

### 6.9 Misc

#### `<Backdrop />`

Overlay escuro full-screen. Use raramente — geralmente Dialog ja inclui o seu.

---

#### `<Modal />`

Use **somente** se Dialog/Drawer/Popover nao servem. Caso raro.

---

#### `<ClickAwayListener />`

Detecta clique fora de um elemento. Util para fechar popovers/menus custom.

```tsx
<ClickAwayListener onClickAway={handleClose}>
  <Box>{/* conteudo */}</Box>
</ClickAwayListener>
```

---

## 7. Receitas de UI

### 7.1 Form com header + actions

```tsx
<Stack spacing={layout.stack}>
  <Typography variant="h3">Nova transacao</Typography>

  <Controller
    name="description"
    control={control}
    render={({ field, fieldState }) => (
      <TextField {...field} label="Descricao"
        error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth />
    )}
  />

  <Controller name="amount" ... />
  <Controller name="date" ... />

  <Stack direction="row" spacing={layout.inline} justifyContent="flex-end" sx={{ mt: layout.cluster }}>
    <Button variant="text" onClick={onCancel}>Cancelar</Button>
    <Button variant="contained" type="submit" disabled={isSubmitting}>
      {isSubmitting ? <CircularProgress size={20} /> : "Salvar"}
    </Button>
  </Stack>
</Stack>
```

### 7.2 Confirmacao destrutiva

```tsx
<DialogShell
  open={open}
  onClose={onClose}
  title="Excluir transacao?"
  description="Esta acao nao pode ser desfeita."
  actions={
    <>
      <Button variant="text" onClick={onClose}>Cancelar</Button>
      <Button variant="contained" color="error" onClick={handleConfirm}>
        Excluir
      </Button>
    </>
  }
>
  <Typography variant="body2">
    Voce esta prestes a excluir <strong>{transactionDescription}</strong>.
  </Typography>
</DialogShell>
```

### 7.3 Lista com EmptyState

```tsx
{isLoading ? (
  <Stack spacing={layout.stack}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Skeleton key={i} variant="rectangular" height={56} />
    ))}
  </Stack>
) : items.length === 0 ? (
  <EmptyState
    icon={<InboxIcon sx={{ fontSize: 48 }} />}
    title="Nenhum item encontrado"
    description="Ajuste os filtros ou crie um novo item."
    action={<Button variant="contained">Criar item</Button>}
  />
) : (
  <Table>...</Table>
)}
```

### 7.4 Card com KPI + tendencia

```tsx
<KpiCard
  label="Total do mes"
  value={totalCents}
  delta={{ value: deltaPct, period: "vs mes anterior", intent: "negative-is-good" }}
  sparkline={last6Months}
  loading={isLoading}
/>
```

### 7.5 Toolbar com filtros + acoes

```tsx
<Stack
  direction={{ xs: "column", md: "row" }}
  spacing={layout.stack}
  alignItems={{ md: "center" }}
  justifyContent="space-between"
  sx={{ mb: layout.cluster }}
>
  <Stack direction="row" spacing={layout.inline} flexWrap="wrap">
    <TextField size="small" placeholder="Buscar..." />
    <Autocomplete size="small" options={...} sx={{ minWidth: 180 }} />
    <DatePicker label="De" slotProps={{ textField: { size: "small" } }} />
  </Stack>
  <Button variant="contained" startIcon={<AddIcon />}>
    Nova transacao
  </Button>
</Stack>
```

---

## 8. Dark Mode

- Dark mode **nao** e light com cores invertidas. E um tema completo.
- Em dark, **texto nunca e branco puro** (`#FFF`). Sempre `#F0EDE5` (off-white quente).
- Em dark, **fundo nunca e preto puro** (`#000`). Sempre `#1A1815`.
- Saturacao levemente maior em dark (cores precisam "saltar" mais do fundo escuro).
- **Sempre testar em light E dark** antes de PR.

Cuidados especificos:

- Imagens com fundo branco precisam de tratamento (filtro ou container claro).
- Sombras quase invisiveis em ambos os modos — bordas fazem o trabalho.
- Cores de grafico tem variante dark levemente mais clara (ver `getChartColors`).

---

## 9. Anti-patterns

### Estilo
- **Hardcode de cores** (`sx={{ color: "#1A1815" }}`): sempre tokens.
- **Hardcode em SVG/recharts** (`fill="#2e7d32"`): use `theme.palette.*` ou `getChartColors(mode)`.
- **`!important`**: NUNCA.
- **`style={}` inline com cores/tamanhos**: sempre `sx` com tokens.
- **Misturar fontes**: nunca mais de 2 (Inter + JetBrains Mono).
- **Border radius inconsistente**: nunca `borderRadius: 7` ou `9`. Sempre dos tokens.

### Componentes
- **`<Dialog>` cru**: use `<DialogShell>`.
- **`<Chip color="default" variant="outlined">`** para etiquetas neutras: use `<StatusBadge variant="neutral">`.
- **`<Card elevation={4}>`** ou similar: tema forca elevation 0 + borda.
- **`<Button color="secondary">`**: nao configurado, fica padrao MUI feio. Use variant outlined/text.
- **`<Fab>`**: nao se encaixa no estilo, nao usar.
- **`<TextField variant="filled">`**: tema configura `outlined`.
- **`<Typography fontWeight="bold">`** em headings: ja vem do tema.
- **`success.50`, `error.50`**: nao existem no tema. Use `success.light`, `error.light` ou `success.subtle`.

### Acessibilidade
- **`<IconButton>` sem `aria-label`**.
- **Tooltip em elemento touch-only** (sem fallback visivel).
- **Cor como unica informacao** (vermelho sozinho nao basta — adicione icone/texto).
- **Contraste insuficiente** (sempre validar texto sobre fundo colorido).

### Layout
- **Espacamento direto em px**: `marginTop: "13px"`. Use escala (`mt: 3`).
- **Container dentro de container** (limita largura duplo).
- **`<Box display="flex">`** quando Stack faz o mesmo.

### Hydration
- **`useMediaQuery({ noSsr: true })` no ThemeProvider**: causa mismatch.
- **`useMediaQuery` sem `AppRouterCacheProvider`**.

---

## 10. Checklist de PR

Antes de pedir review em qualquer mudanca de UI:

**Tokens**
- [ ] Zero cores hex hardcoded fora de `design-tokens.ts`/`theme.ts`.
- [ ] Fills SVG/recharts via `theme.palette.*` ou `getChartColors(mode)`.
- [ ] Espacamentos via escala (`mt: 4`, `gap: layout.stack`, etc.).
- [ ] Radius via tokens.
- [ ] Sem `!important`, sem `style={}` com cores.

**Componentes**
- [ ] Dialogs via `<DialogShell>`.
- [ ] Valores monetarios via `<MoneyValue>` ou Typography com `var(--font-jetbrains-mono)`.
- [ ] Status financeiros via `<StatusBadge>`.
- [ ] PageHeader em paginas de conteudo principal.
- [ ] EmptyState para listas vazias.

**Layout**
- [ ] Containers com `maxWidth` apropriado.
- [ ] Espacamentos semanticos (`layout.page`, `layout.section`, `layout.cluster`).

**Tipografia**
- [ ] Hierarquia via `<Typography variant>`.
- [ ] Sem `fontWeight="bold"` redundante em headings.

**Acessibilidade**
- [ ] Todo `<IconButton>` tem `aria-label`.
- [ ] Cor nao e a unica informacao (icone+texto+cor).
- [ ] Focus visivel.

**Modos**
- [ ] Testado em light **E** dark mode.
- [ ] Sem hydration warning no console.

**Performance**
- [ ] Sem layout shift visivel (Skeleton com dimensoes corretas).
- [ ] Listas grandes com virtualizacao (DataGrid ou virtual).

---

## Recursos

- **Tokens**: `src/lib/design-tokens.ts`
- **Tema MUI**: `src/lib/theme.ts`
- **Wrappers**: `src/components/ui/` (Section, PageHeader, EmptyState, KpiCard, DialogShell, MoneyValue, StatusBadge, ExpandableIconButton)
- **Inspiracao**: Notion, Things 3, Linear, Cron Calendar, Arc Browser
- **Inter**: https://fonts.google.com/specimen/Inter
- **JetBrains Mono**: https://www.jetbrains.com/lp/mono/
- **Contrast checker**: https://webaim.org/resources/contrastchecker/