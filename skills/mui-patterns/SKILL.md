# SKILL — Material UI Patterns

## Quando usar

Sempre que criar ou tocar em qualquer componente de UI. Estabelece convenções de integração com Next.js App Router (RSC), e padrões comuns de form/table/modal com MUI.

> ⚠️ **Pré-requisito**: leia primeiro `skills/design-system/SKILL.md`. Este skill cobre **como usar MUI**; o design-system cobre **quais tokens e padrões visuais**. Os dois se complementam.

## Princípio

**MUI é a única biblioteca de UI do projeto.** Não misturar com Tailwind, shadcn ou CSS modules. Customização via **tema MUI customizado** (`src/lib/theme.ts`) + **tokens semânticos** (`src/lib/design-tokens.ts`) + `sx prop` + `styled API` quando necessário.

## Pacotes

```bash
pnpm add @mui/material @mui/icons-material @emotion/react @emotion/styled
pnpm add @mui/x-date-pickers       # date picker
pnpm add @mui/x-data-grid          # tabela avançada (opcional, para FinanceTable)
pnpm add @mui/x-charts             # gráficos (alternativa ao recharts)
```

> **Emotion** é o styling engine default do MUI. Mantemos ele.
> **Não** instalar `tailwindcss` — o `create-next-app` pergunta sobre Tailwind: **responder não**.

## Setup no App Router

### 1. AppRouterCacheProvider

```tsx
// src/app/layout.tsx
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "@/lib/theme";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
```

> `AppRouterCacheProvider` garante que Emotion injete CSS corretamente no SSR.

### 2. Tema customizado

**Definido em `src/lib/theme.ts`** — ver `skills/design-system/SKILL.md` para detalhes completos do design system "Warm Calm" (paleta, tipografia, espaçamento, etc.).

O tema exporta `lightTheme` e `darkTheme`, ambos com:
- Locale `ptBR` aplicado.
- Tipografia Inter + JetBrains Mono (mono para valores monetários).
- Palette estendida com tokens semânticos (`surface`, `border`, `accent`, `danger`, `neutral`).
- Variantes Typography customizadas (`kpi`, `mono`).
- Component overrides em todos os componentes principais (Button, Card, TextField, Table, etc.).

```ts
// Import básico
import { lightTheme, darkTheme, getTheme } from "@/lib/theme";

// Ou tokens diretamente para casos avançados
import { lightColors, spacing, radius } from "@/lib/design-tokens";
```

### 3. Modo dark

Dark mode é primeira-classe (não afterthought). Os dois temas estão prontos em `src/lib/theme.ts`. Toggle persistido via cookie.

```tsx
// src/components/ThemeProvider.tsx
"use client";
import { useState } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { lightTheme, darkTheme } from "@/lib/theme";
import type { ThemeMode } from "@/lib/design-tokens";

export function ThemeProvider({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode: ThemeMode;
}) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  return (
    <MuiThemeProvider theme={mode === "light" ? lightTheme : darkTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
```

Detalhes (tokens dark, princípios) em `skills/design-system/SKILL.md`.

## Server Components vs Client Components

**Maioria dos componentes MUI precisa de `"use client"`**. Eles usam Context, useState, etc.

**Estratégia**:
- Páginas (`page.tsx`) e layouts ficam como **Server Components** (default).
- Componentes interativos com MUI ficam em arquivos separados com `"use client"` no topo.
- Composição: Server Component busca dados + renderiza Client Component.

```tsx
// src/app/(app)/months/[monthId]/page.tsx (Server Component)
import { getMonthData } from "@/lib/queries/months";
import { MonthView } from "./MonthView"; // client component

export default async function MonthPage({ params }: Props) {
  const data = await getMonthData(params.monthId);
  return <MonthView data={data} />;
}
```

```tsx
// src/app/(app)/months/[monthId]/MonthView.tsx (Client Component)
"use client";
import { Box, Tabs, Tab } from "@mui/material";

export function MonthView({ data }: Props) {
  // hooks, state, etc.
  return <Box>...</Box>;
}
```

## Sistema de styling

### Ordem de preferência

1. **Variantes e props do componente** (`variant`, `size`, `color`).
2. **`sx` prop** para customizações pontuais inline.
3. **`styled` API** para componentes reutilizáveis com estilo customizado.
4. **Tema** para customizações globais (cores, tipografia, defaults).

### Exemplo: `sx` prop

```tsx
<Box
  sx={{
    display: "flex",
    flexDirection: "column",
    gap: 2,         // 2 * 8px = 16px (theme.spacing)
    p: 3,           // padding
    borderRadius: 1, // theme.shape.borderRadius
    bgcolor: "background.paper",
  }}
>
  ...
</Box>
```

> `sx` aceita callback: `sx={(theme) => ({ color: theme.palette.primary.main })}`.

### Exemplo: `styled`

```ts
import { styled } from "@mui/material/styles";
import { Box } from "@mui/material";

export const Card = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
}));
```

### Anti-pattern
❌ Inline styles com `style={}` (não usa o tema, sem fallback).
❌ CSS modules misturados (vai criar conflito de specificity).
❌ Tailwind classes (não estão configuradas).

## Forms com React Hook Form + MUI

Integração via `Controller` (necessário porque MUI controla seu próprio state).

```tsx
"use client";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  FormLabel,
  Switch,
  Button,
  Stack,
} from "@mui/material";
import { transactionFormSchema } from "@/lib/schemas/transaction";

export function TransactionForm({ accountId, tableId }: Props) {
  const form = useForm({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: { /* ... */ },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Stack spacing={2}>
        {/* Controlled TextField */}
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label="Descrição"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              fullWidth
            />
          )}
        />

        {/* Select */}
        <Controller
          name="categoryId"
          control={form.control}
          render={({ field, fieldState }) => (
            <FormControl error={!!fieldState.error} fullWidth>
              <FormLabel>Categoria</FormLabel>
              <Select {...field} value={field.value ?? ""}>
                <MenuItem value="">Nenhuma</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        {/* Switch */}
        <Controller
          name="isPending"
          control={form.control}
          render={({ field }) => (
            <FormControlLabel
              control={<Switch {...field} checked={field.value} />}
              label="Pendente"
            />
          )}
        />

        <Button type="submit" variant="contained">Salvar</Button>
      </Stack>
    </form>
  );
}
```

### Date Picker

```tsx
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { ptBR } from "date-fns/locale";

// Envolver app (uma vez no layout)
<LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
  {children}
</LocalizationProvider>

// Usar
<Controller
  name="occurredOn"
  control={form.control}
  render={({ field, fieldState }) => (
    <DatePicker
      label="Data"
      value={field.value}
      onChange={field.onChange}
      slotProps={{
        textField: {
          error: !!fieldState.error,
          helperText: fieldState.error?.message,
          fullWidth: true,
        },
      }}
    />
  )}
/>
```

### Currency Input

MUI não tem input monetário nativo. Combinar `TextField` + biblioteca de máscara (ex: `react-number-format`):

```tsx
import { NumericFormat } from "react-number-format";
import { TextField } from "@mui/material";
import { reaisToCents, centsToReais } from "@/lib/money";

<Controller
  name="amountCents"
  control={form.control}
  render={({ field, fieldState }) => (
    <NumericFormat
      customInput={TextField}
      thousandSeparator="."
      decimalSeparator=","
      prefix="R$ "
      decimalScale={2}
      fixedDecimalScale
      value={field.value ? centsToReais(field.value) : ""}
      onValueChange={(values) => {
        field.onChange(values.floatValue != null ? reaisToCents(values.floatValue) : 0n);
      }}
      label="Valor"
      error={!!fieldState.error}
      helperText={fieldState.error?.message}
      fullWidth
    />
  )}
/>
```

## Tabelas

Duas opções para FinanceTable:

### A) `<Table>` básico (recomendado para MVP)
Componente padrão do MUI. Simples, flexível, fácil de customizar.

```tsx
import { Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper } from "@mui/material";

<TableContainer component={Paper}>
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell>Data</TableCell>
        <TableCell>Descrição</TableCell>
        <TableCell align="right">Valor</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {transactions.map((tx) => (
        <TableRow key={tx.id} hover>
          <TableCell>{format(tx.occurredOn, "dd/MM")}</TableCell>
          <TableCell>{tx.description}</TableCell>
          <TableCell align="right">{formatCentsToBrl(tx.amountCents)}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

### B) `<DataGrid>` (MUI X)
Mais features (sort, filter, virtualização) mas mais peso. Considerar para tabelas com 500+ linhas.

```tsx
import { DataGrid, GridColDef } from "@mui/x-data-grid";

const columns: GridColDef[] = [
  { field: "occurredOn", headerName: "Data", width: 100 },
  { field: "description", headerName: "Descrição", flex: 1 },
  { field: "amountCents", headerName: "Valor", width: 120, valueFormatter: ({ value }) => formatCentsToBrl(value) },
];

<DataGrid rows={transactions} columns={columns} pageSizeOptions={[25, 50, 100]} />
```

> **MVP**: começar com `<Table>` básico. Migrar para `DataGrid` se precisar das features.

## Páginas de Configurações — padrão canônico

Todas as páginas em `src/app/(app)/[accountId]/settings/` seguem **exatamente** este layout. Referência: `settings/sections/`.

### Página (`page.tsx` — Server Component)

```tsx
// Wrapper externo: p: 4, maxWidth: 700 (sem mx: "auto" — alinha à esquerda)
<Box sx={{ p: 4, maxWidth: 700 }}>
  <Typography variant="h5" fontWeight="bold" mb={3}>
    {m.settings.sections.title}
  </Typography>
  <SectionsManager accountId={accountId} initialSections={sections} />
</Box>
```

| Propriedade | Valor |
|---|---|
| `p` | `4` (32px) |
| `maxWidth` | `700` |
| `mx` | **nunca** `"auto"` — conteúdo alinha à esquerda |
| Typography | `variant="h5"`, `fontWeight="bold"`, `mb={3}` |

### Manager (`*Manager.tsx` — Client Component)

#### Botão de ação principal (topo)

```tsx
<Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
  <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={...}>
    Nova seção
  </Button>
</Box>
```

- Sempre `size="small"` — padrão de densidade.
- `justifyContent: "flex-end"` — botão à direita.

#### Itens em lista

```tsx
<Paper variant="outlined" sx={{ px: 2, py: 1.5 }}>
  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    <Typography variant="body2" fontWeight="medium" sx={{ flex: 1 }}>
      {item.name}
    </Typography>
    {/* chips opcionais */}
    <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0 }}>
      <IconButton size="small" onClick={...}>
        <EditIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <IconButton size="small" color="error" onClick={...}>
        <DeleteIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  </Box>
</Paper>
```

- `IconButton` sempre `size="small"` com ícone `sx={{ fontSize: 16 }}`.
- `Typography` de nome sempre `variant="body2" fontWeight="medium"`.
- Container de ícones: `gap: 0.25` (2px).

### Diálogos de configurações

#### Criação / Edição (formulário simples)

```tsx
<Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
  <DialogTitle>Nova seção</DialogTitle>
  <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <TextField label="Nome" fullWidth autoFocus ... />
  </DialogContent>
  <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
    <Button onClick={onClose}>Cancelar</Button>
    <Button variant="contained" onClick={onSave}>Salvar</Button>
  </DialogActions>
</Dialog>
```

#### Confirmação de exclusão

```tsx
<Dialog open={open} onClose={onClose}>
  <DialogTitle>Excluir</DialogTitle>
  <DialogContent>
    <DialogContentText>Confirmar exclusão?</DialogContentText>
  </DialogContent>
  <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
    <Button onClick={onClose}>Cancelar</Button>
    <Button color="error" variant="contained" onClick={onConfirm}>Excluir</Button>
  </DialogActions>
</Dialog>
```

| Propriedade de Dialog | Valor |
|---|---|
| `maxWidth` (form) | `"xs"` + `fullWidth` |
| `DialogActions.px` | `3` (24px) |
| `DialogActions.pb` | `2.5` (20px) |
| `DialogActions.gap` | `1` (8px) |

> ❌ **Nunca** `pb: 2` nos DialogActions — ficaria inconsistente com a referência.

## Diálogos / Modais

```tsx
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";

<Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
  <DialogTitle>Nova Tabela</DialogTitle>
  <DialogContent>
    {/* form */}
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancelar</Button>
    <Button variant="contained" onClick={handleSubmit}>Criar</Button>
  </DialogActions>
</Dialog>
```

> Em mobile, considerar `fullScreen={isMobile}` para melhor UX.

## Notifications (Toasts)

MUI tem `<Snackbar>` mas é "1 por vez". Para múltiplos toasts, usar `notistack`:

```bash
pnpm add notistack
```

```tsx
// layout.tsx
import { SnackbarProvider } from "notistack";

<SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
  {children}
</SnackbarProvider>
```

```tsx
// uso
import { useSnackbar } from "notistack";

const { enqueueSnackbar } = useSnackbar();
enqueueSnackbar("Transação criada", { variant: "success" });
```

## Ícones

```tsx
import { Add, Delete, Edit, Star, StarBorder } from "@mui/icons-material";

<IconButton size="small"><Edit /></IconButton>
<Button startIcon={<Add />}>Nova transação</Button>
```

> Imports nomeados, **não default import do pacote inteiro** (tree shaking).

## Responsividade

```tsx
// Em sx
<Box sx={{ display: { xs: "block", md: "flex" } }} />

// Hook
import { useMediaQuery, useTheme } from "@mui/material";
const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down("md"));
```

Breakpoints default:
- `xs`: 0px
- `sm`: 600px
- `md`: 900px
- `lg`: 1200px
- `xl`: 1536px

## Performance

- **Imports nomeados** (`import { Button } from "@mui/material"`) — Next.js + MUI tree-shake bem.
- **Avoid `sx` prop em listas grandes** — cria objeto novo a cada render. Use `styled` se estilo é fixo.
- **Memoize componentes filhos** em listas: `React.memo`.
- **Bundle size**: MUI é pesado (~150KB gzipped). Considerar `next/dynamic` para componentes grandes (DataGrid, Charts).

## Anti-patterns

❌ Misturar com Tailwind / shadcn
❌ Customizar via `!important` no CSS
❌ Esquecer `AppRouterCacheProvider` (FOUC no SSR)
❌ Usar `useState` em Server Component
❌ Importar `@mui/icons-material` inteiro (default import → bundle gigante)
❌ Modificar tema em runtime sem `ThemeProvider` wrapper
❌ `sx` com expressões complexas em loops (cria objeto a cada render)

## Recursos

- [MUI Docs](https://mui.com)
- [MUI + Next.js example](https://github.com/mui/material-ui/tree/master/examples/material-ui-nextjs-ts)
- [MUI X (data grid, date picker, charts)](https://mui.com/x/)
