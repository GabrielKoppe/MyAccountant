# SKILL — Material UI: Integração com Next.js e Forms

## Quando usar

Sempre que criar ou tocar em qualquer componente de UI. Este skill cobre **como integrar MUI com Next.js App Router, RSC e React Hook Form**.

> **Pré-requisito**: leia `skills/design-system/SKILL.md` primeiro. O design-system cobre tokens visuais, especificação de cada componente, wrappers (PageHeader, Section, KpiCard, DialogShell, EmptyState), layout e anti-patterns visuais. Este skill cobre **infraestrutura e integração**.

## Princípio

**MUI é a única biblioteca de UI do projeto.** Não misturar com Tailwind, shadcn ou CSS modules. Customização via `sx prop`, `styled API` e overrides no tema.

## Pacotes

```bash
pnpm add @mui/material @mui/icons-material @emotion/react @emotion/styled
pnpm add @mui/x-date-pickers       # date picker
pnpm add @mui/x-data-grid          # tabela com virtualização (opcional)
pnpm add @mui/x-charts             # gráficos (alternativa ao recharts)
```

> **Emotion** é o styling engine default do MUI. Mantemos ele.  
> **Não** instalar `tailwindcss` — o `create-next-app` pergunta sobre Tailwind: **responder não**.

---

## Setup no App Router

### 1. AppRouterCacheProvider (CRÍTICO)

Sem isto, Emotion injeta CSS errado no SSR → FOUC.

```tsx
// src/app/layout.tsx
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AppRouterCacheProvider>
          <AppProviders>{children}</AppProviders>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
```

### 2. ThemeProvider e dark mode

Ver `skills/design-system/SKILL.md §4`. Setup já implementado em:
- `src/components/providers/ThemeProviderClient.tsx` — lógica de toggle
- `src/components/providers/AppProviders.tsx` — wrapper de providers
- `src/lib/theme.ts` — `lightTheme` e `darkTheme`
- `src/lib/design-tokens.ts` — tokens exportados

```ts
// Import tokens para uso em código TS puro (fora do tema)
import { layout, containers, lightColors } from "@/lib/design-tokens";
```

### 3. `useMediaQuery` sem noSsr

**Crítico**: nunca usar `{ noSsr: true }` no `useMediaQuery` dentro do ThemeProvider. Causa mismatch de hash Emotion entre server e client.

```tsx
// ✅ correto
const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

// ❌ errado — causa hydration mismatch
const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
```

---

## Server Components vs Client Components

**Maioria dos componentes MUI precisa de `"use client"`** — usam Context, useState, hooks.

**Estratégia recomendada**:
- Páginas (`page.tsx`) e layouts ficam como **Server Components** (default no App Router).
- Componentes interativos ficam em arquivos separados com `"use client"`.
- Server Component busca dados → passa como props para Client Component.
- Client Components podem ser passados como `children` ou props para outros Client Components — isso não quebra o boundary.

```tsx
// page.tsx — Server Component
import { MonthView } from "./MonthView";

export default async function MonthPage({ params }: Props) {
  const data = await prisma.month.findUnique({ where: { id: params.monthId } });
  return <MonthView data={data} />;
}
```

```tsx
// MonthView.tsx — Client Component
"use client";
import { useState } from "react";
import Box from "@mui/material/Box";

export function MonthView({ data }: Props) {
  const [tab, setTab] = useState(0);
  return <Box>...</Box>;
}
```

**Passando Client Components como props de Server Components:**
```tsx
// page.tsx (Server)
<PageHeader
  title="Membros"
  actions={<InviteForm accountId={accountId} />}  // Client Component como prop — ok
/>
```

---

## Sistema de styling

### Ordem de preferência

1. **Variantes e props do componente** (`variant`, `size`, `color`) — first.
2. **`sx` prop** — customizações pontuais inline com tokens semânticos.
3. **`styled` API** — componentes reutilizáveis com estilo encapsulado.
4. **Tema** (`src/lib/theme.ts`) — customizações globais.

### `sx` com tokens

Sempre usar tokens semânticos (via tema ou `layout`), nunca px diretos nem hex.

```tsx
import { layout } from "@/lib/design-tokens";

<Box
  sx={{
    p: layout.page,          // 32px — não escrever sx={{ p: 8 }}
    mb: layout.cluster,      // 24px — não escrever sx={{ mb: 6 }}
    bgcolor: "background.surface",  // token do tema
    borderColor: "border.subtle",   // token do tema
  }}
/>
```

### `sx` callback (acesso ao tema)

```tsx
<Box sx={(theme) => ({ color: theme.palette.primary.main })} />
```

### `styled` API

Para componentes reutilizáveis que precisam de estilo fixo:

```ts
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";

export const MonoBox = styled(Box)(({ theme }) => ({
  fontFamily: theme.typography.mono,
  fontSize: theme.typography.pxToRem(14),
}));
```

---

## Forms com React Hook Form + MUI

Todo formulário usa `Controller` porque MUI gerencia seu próprio estado interno.

```tsx
"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { layout } from "@/lib/design-tokens";

export function TransactionForm() {
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: { description: "", amountCents: 0n },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={layout.stack}>
        <Controller
          name="description"
          control={control}
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

        <Controller
          name="categoryId"
          control={control}
          render={({ field, fieldState }) => (
            <FormControl fullWidth error={!!fieldState.error}>
              <InputLabel>Categoria</InputLabel>
              <Select {...field} value={field.value ?? ""} label="Categoria">
                <MenuItem value=""><em>Nenhuma</em></MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        <Controller
          name="isPending"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Switch {...field} checked={field.value} />}
              label="Pendente"
            />
          )}
        />

        <Stack direction="row" spacing={layout.inline} justifyContent="flex-end">
          <Button variant="text" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" variant="contained">Salvar</Button>
        </Stack>
      </Stack>
    </form>
  );
}
```

### Date Picker com Controller

```tsx
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

<Controller
  name="occurredOn"
  control={control}
  render={({ field, fieldState }) => (
    <DatePicker
      label="Data"
      value={field.value}
      onChange={field.onChange}
      format="dd/MM/yyyy"
      slotProps={{
        textField: {
          error: !!fieldState.error,
          helperText: fieldState.error?.message,
          fullWidth: true,
          size: "small",
        },
      }}
    />
  )}
/>
```

Requer `<LocalizationProvider dateAdapter={AdapterDateFnsV3} adapterLocale={ptBR}>` no root layout.

### Currency Input (BigInt → centavos)

```tsx
import { NumericFormat } from "react-number-format";
import { reaisToCents, centsToReais } from "@/lib/money";

<Controller
  name="amountCents"
  control={control}
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

---

## Tabelas

### `<Table>` básico (recomendado para < 500 linhas)

```tsx
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";

<TableContainer>
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
          <TableCell align="right">
            <MoneyValue cents={tx.amountCents} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

Regra de alinhamento: datas e texto à esquerda, números e ações à direita.

### `<DataGrid>` (MUI X — 500+ linhas)

```tsx
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

const columns: GridColDef[] = [
  { field: "occurredOn", headerName: "Data", width: 100 },
  { field: "description", headerName: "Descrição", flex: 1 },
];

<DataGrid
  rows={transactions}
  columns={columns}
  sx={{
    border: 1,
    borderColor: "border.subtle",
    borderRadius: "12px",
    "& .MuiDataGrid-columnHeaders": { bgcolor: "background.subtle" },
  }}
  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
/>
```

---

## Notifications (Toasts)

Usar sempre `notistack` (configurado em `AppProviders`). **Nunca** usar `<Snackbar>` do MUI diretamente.

```tsx
import { useSnackbar } from "notistack";

const { enqueueSnackbar } = useSnackbar();
enqueueSnackbar("Transação criada", { variant: "success" });
enqueueSnackbar("Falha ao salvar", { variant: "error" });
```

---

## Ícones

Imports nomeados (tree-shaking):

```tsx
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

<Button startIcon={<AddIcon />}>Nova transação</Button>
<IconButton size="small" aria-label="Editar"><EditIcon fontSize="small" /></IconButton>
```

**Nunca** importar o pacote inteiro (`import * from "@mui/icons-material"` — bundle gigante).

---

## Responsividade

```tsx
// sx responsivo
<Stack direction={{ xs: "column", sm: "row" }} spacing={layout.stack} />

// Hook
import { useMediaQuery, useTheme } from "@mui/material";
const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
```

Breakpoints do projeto: `xs` 0, `sm` 600, `md` 900, `lg` 1200, `xl` 1536.

---

## Performance

- **Imports granulares**: `import Button from "@mui/material/Button"` bate tree-shake melhor que `import { Button } from "@mui/material"` em alguns bundlers.
- **`sx` em listas grandes**: evitar objeto literal complexo em loop — cria objeto novo a cada render. Usar `styled` ou extrair `sx` para constante fora do componente.
- **`React.memo`** em filhos de listas grandes.
- **`next/dynamic`** para componentes pesados (`DataGrid`, `SankeyChart`, `SandboxPage`).

```tsx
const SandboxPage = dynamic(() => import("./SandboxPage"), { ssr: false });
```

---

## Anti-patterns

❌ Misturar Tailwind / shadcn / CSS modules com MUI  
❌ Customizar via `!important` em qualquer lugar  
❌ Esquecer `AppRouterCacheProvider` → FOUC no SSR  
❌ `useMediaQuery({ noSsr: true })` no ThemeProvider → hydration mismatch  
❌ `useState` em Server Component  
❌ Default import do pacote de ícones inteiro  
❌ Usar `<Dialog>` cru — usar `<DialogShell>` (ver design-system)  
❌ Usar `<Snackbar>` do MUI — usar `notistack`  
❌ `sx` com px diretos (`marginTop: "13px"`) — usar escala do tema ou tokens de layout  
❌ `sx={{ p: 8 }}` como número mágico — usar `sx={{ p: layout.page }}` com token semântico  

---

## Recursos

- [MUI Docs](https://mui.com)
- [MUI + Next.js App Router](https://mui.com/material-ui/integrations/nextjs/)
- [MUI X (data grid, date picker, charts)](https://mui.com/x/)
- **Design tokens do projeto**: `src/lib/design-tokens.ts`
- **Tema customizado**: `src/lib/theme.ts`
- **Wrappers de UI**: `src/components/ui/`
