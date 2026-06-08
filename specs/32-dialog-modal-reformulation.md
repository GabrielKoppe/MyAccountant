# Spec 32 — Reformulação dos Dialogs e Modals

> Status: approved
> Insumo: `skills/design-system/SKILL.md §5.5` · `skills/mui-patterns/SKILL.md` · revisão de código em `src/components/ui/DialogShell.tsx` · `src/components/finance-tables/CreateTableModal.tsx` · `src/components/transactions/MoveTransactionsDialog.tsx` · `src/components/months/CreateMonthModal.tsx` · `src/components/csv-import/ImportWizard.tsx` · managers em `src/app/(app)/[accountId]/settings/`
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md)

---

## 1. Problema

Sete problemas identificados na revisão sistemática dos dialogs e modais do projeto:

- **DLG-01**: `DialogShell` não possui prop `loading`. Durante operações assíncronas (submit de form, chamada de Server Action), o usuário pode fechar o dialog via ESC ou clique no backdrop, interrompendo a operação silenciosamente. Além disso, `description` aceita apenas `string`, impedindo conteúdo rico (negrito, link) no subtítulo do header. O atributo `aria-label={ariaLabel ?? title}` no `<Dialog>` root está incorreto — o padrão WAI-ARIA para dialogs modais usa `aria-labelledby` apontando para o `id` do `<DialogTitle>`, não `aria-label` no elemento raiz.

- **DLG-02**: Espaçamento mágico no conteúdo dos dialogs. `CreateTableModal` usa `spacing={2.5}`, `spacing={1.5}` e `spacing={2}` em `<Stack>` internos. `MoveTransactionsDialog` usa `spacing={2.5}` e `spacing={2}`. `ImportWizard` usa `gap: 3` em `<Box>`. Nenhum desses valores corresponde a tokens semânticos definidos em `src/lib/design-tokens.ts` (`layout.stack = 4 = 16px`, `layout.cluster = 6 = 24px`, `layout.inline = 2 = 8px`).

- **DLG-03**: Anti-padrão de composição de formulário. `CreateTableModal`, `SectionsManager` e `InviteForm` envolvem `<DialogShell>` com `<Box component="form">` *fora* do shell — como `Dialog` do MUI usa um portal (`document.body`), o elemento `<form>` no DOM não contém o conteúdo renderizado do dialog. O `<Button type="submit">` nas `actions` não está semanticamente dentro do `<form>`, o que é incorreto e frágil. O padrão correto é colocar o `<form id="...">` dentro do `children` do `DialogShell` e usar `form={id}` no botão de submit das actions.

- **DLG-04**: `<Box sx={{ display: "flex" }}>` no lugar de `<Stack>` em conteúdo de dialog. `CreateMonthModal` usa `<Box sx={{ display: "flex", gap: 2, pt: 1 }}>` — deveria ser `<Stack direction="row" spacing={layout.inline}>`. O `pt: 1` é número mágico (4px) sem nome semântico; deveria ser `pt: layout.micro`.

- **DLG-05**: Exibição de erros inconsistente dentro de dialogs. `CreateMonthModal` exibe erro de operação via `<Box sx={{ mt: 1, color: "error.main", typography: "body2" }}>` em vez de `<Alert severity="error">`. O padrão correto — alinhado ao design system — é sempre usar `<Alert severity="error">` para erros operacionais (distintos de erros de campo, que ficam em `helperText` do `TextField`).

- **DLG-06**: `fontWeight="bold"` e strings hardcoded. `MoveTransactionsDialog` usa `<Typography ... fontWeight="bold">CONFIGURAR NOVA TABELA</Typography>` — anti-padrão explícito no design system (deve-se usar a variante tipográfica correta). O texto `"CONFIGURAR NOVA TABELA"`, as strings de snackbar (`"${N} transação(ões) movida(s) para..."`) e o label do botão de submit dinâmico não passam por `src/lib/messages/`, violando a regra de centralização de mensagens de UI.

- **DLG-07**: Padrão de estado de carregamento inconsistente. `CreateMonthModal` usa apenas `disabled={loading}` sem indicador visual de progresso. `CreateTableModal` usa `disabled={form.formState.isSubmitting}` também sem indicador. `MoveTransactionsDialog` usa `<CircularProgress size={16}>` no `endIcon` do botão — o padrão correto, mas não documentado nem seguido uniformemente.

---

## 2. Solução

Divisão em dois grupos: melhorias na infraestrutura (`DialogShell`) e normalização dos consumidores existentes.

### 2.1 Melhorias no `DialogShell`

- **DLG-01a** — Adicionar prop `loading?: boolean`. Quando `true`: `disableEscapeKeyDown` é ativado no `<Dialog>`; clique no backdrop não dispara `onClose`; botão X é desabilitado; todos os botões passados nas `actions` recebem `disabled={true}` automaticamente via `React.cloneElement` (o consumidor não precisa gerenciar o botão cancelar manualmente).
- **DLG-01b** — Ampliar tipo de `description` de `string` para `ReactNode`. `string` continua funcionando sem mudança — zero breaking change. O `DialogShell` mantém o wrapper `<Typography variant="body2">`, portanto `description` deve ser string ou fragmento com inline elements (`<strong>`, `<em>`), nunca um `<Typography>` externo.
- **DLG-01c** — Corrigir acessibilidade: gerar `titleId` com `useId()` e usar `aria-labelledby={titleId}` no `<Dialog>` root; passar `id={titleId}` ao `<DialogTitle>`. Remover prop `ariaLabel` imediatamente (fazer grep em todos os consumidores antes; remover os usos junto com a mudança no `DialogShell`).

### 2.2 Normalização dos consumidores

- **DLG-02** — Substituir todos os `spacing={N}` e `gap: N` avulsos dentro de conteúdo de `DialogShell` por tokens: `layout.stack` (entre campos de form), `layout.cluster` (entre grupos lógicos), `layout.inline` (elementos inline).
- **DLG-03** — Corrigir `CreateTableModal`, `SectionsManager` e `InviteForm`: remover `<Box component="form">` externo; mover `<form id="...">` para dentro do `children` do `DialogShell`; adicionar `form="..."` ao `<Button type="submit">` nas actions.
- **DLG-04** — Substituir `<Box sx={{ display: "flex" }}>` por `<Stack direction="row">` em `CreateMonthModal` e demais consumidores com esse padrão dentro de dialogs.
- **DLG-05** — Padronizar exibição de erro operacional via `<Alert severity="error">` dentro do `children`. Posição: topo do conteúdo para erros de carregamento; após os campos para erros de submit.
- **DLG-06** — Substituir `<Typography fontWeight="bold">` por variante tipográfica correta (`overline` para labels de seção interna em caixa-alta). Mover todas as strings de UI de dialogs para `src/lib/messages/pt-BR.ts`; strings interpoladas usam funções inline no objeto `m`.
- **DLG-07** — Padronizar botão de submit: `endIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}`. O `disabled` de loading é gerenciado pelo `DialogShell` via `cloneElement` quando `loading={true}`; o consumidor só precisa passar `disabled` para validação de formulário (ex: `disabled={!isValid}`). Texto do botão não muda durante o submit.

---

## 3. User Stories

- Como desenvolvedor, quero que o `DialogShell` suporte `loading` nativamente, para que dialogs com forms assíncronos bloqueiem fechamento acidental e desabilitem todos os botões sem código extra em cada consumidor.
- Como desenvolvedor, quero um padrão documentado e único de composição de `<form>` dentro de `DialogShell`, para não ter dúvida sobre onde colocar o elemento form e como conectar o botão de submit.
- Como usuário, quero ver um spinner no botão de submit durante operações assíncronas, para saber que minha ação está sendo processada e não clicar duas vezes.
- Como usuário, quero ver mensagens de erro em destaque (`Alert`) dentro do dialog quando uma operação falha, para entender o problema sem perder o contexto do formulário preenchido.
- Como usuário com leitor de tela, quero que o dialog seja anunciado com seu título ao abrir, para navegar o app com acessibilidade adequada.

---

## 4. Critérios de Aceitação

**DLG-01 — DialogShell melhorado:**
- QUANDO `loading={true}` é passado, O DIALOG NÃO DEVE fechar ao pressionar ESC nem ao clicar fora dele.
- QUANDO `loading={true}`, O BOTÃO X no header DEVE estar visualmente desabilitado e não disparar `onClose`.
- QUANDO `loading={true}`, TODOS OS BOTÕES passados nas `actions` DEVEM estar desabilitados automaticamente (via `React.cloneElement`), sem que o consumidor precise passar `disabled` no botão cancelar.
- QUANDO `loading={false}` (padrão), OS BOTÕES nas `actions` NÃO DEVEM receber `disabled` injetado pelo `DialogShell` — `disabled` de validação de formulário passado pelo consumidor continua funcionando normalmente.
- QUANDO `description` recebe um `ReactNode` (ex: `<>Texto com <strong>negrito</strong></>`) O CONTEÚDO DEVE ser renderizado corretamente abaixo do título dentro do wrapper `<Typography variant="body2">` do `DialogShell`.
- O `<Dialog>` root DEVE usar `aria-labelledby={titleId}` onde `titleId` é o `id` do `<DialogTitle>` gerado por `useId()`.
- A prop `ariaLabel` DEVE ser removida e nenhum consumidor DEVE passá-la (verificar via grep antes da remoção).

**DLG-02 — Tokens de espaçamento:**
- NENHUM `<Stack spacing={N}>` ou `<Box sx={{ gap: N }}>` dentro do `children` de um `DialogShell` DEVE usar valor numérico avulso onde existe token semântico equivalente.
- Espaçamento entre campos de form dentro de dialog: `layout.stack` (4 = 16px).
- Espaçamento entre grupos lógicos: `layout.cluster` (6 = 24px) ou `layout.stack` dependendo da densidade.
- Espaçamento inline: `layout.inline` (2 = 8px).

**DLG-03 — Composição de formulário:**
- EM `CreateTableModal`, `SectionsManager` e `InviteForm`, O ELEMENTO `<form>` DEVE estar dentro do `children` do `DialogShell`, e NÃO fora envolvendo o `DialogShell`.
- O `<Button type="submit">` nas `actions` DEVE usar `form="..."` com o id correspondente ao form no children.
- O padrão de referência descrito em §7 DEVE ser seguido em qualquer novo dialog com formulário criado a partir desta spec.

**DLG-04 — Stack em vez de Box flex:**
- EM `CreateMonthModal`, o container dos selects de mês/ano DEVE ser `<Stack direction="row" spacing={layout.inline} sx={{ pt: layout.micro }}>` em vez de `<Box sx={{ display: "flex", gap: 2, pt: 1 }}>`.
- Qualquer `<Box sx={{ display: "flex", flexDirection: "column", gap: N }}>` dentro de dialogs DEVE ser refatorado para `<Stack spacing={layout.*}>`.

**DLG-05 — Exibição de erros:**
- QUANDO uma operação de dialog falha (erro não é de campo específico), O SISTEMA DEVE exibir `<Alert severity="error">{error}</Alert>` dentro do `children` do `DialogShell`.
- NÃO DEVE ser usado `<Box sx={{ color: "error.main" }}>` para erros operacionais em dialogs.
- Erros de campo (validação Zod/RHF) CONTINUAM indo para `helperText` do `TextField` — o `Alert` é exclusivo para erros de operação.

**DLG-06 — Typography e mensagens:**
- EM `MoveTransactionsDialog`, `<Typography fontWeight="bold">CONFIGURAR NOVA TABELA</Typography>` DEVE ser substituído por `<Typography variant="overline" color="text.secondary">Configurar nova tabela</Typography>`.
- Strings de UI dentro de dialogs (labels de botões, mensagens de snackbar, textos condicionais) DEVEM estar em `src/lib/messages/pt-BR.ts`.
- Strings interpoladas (com parâmetros dinâmicos) DEVEM usar funções inline no objeto `m`: ex. `moveSuccess: (n: number, name: string) => \`${n} transação(ões) movida(s) para "${name}"\``.

**DLG-07 — Loading state:**
- O botão de submit principal em qualquer `DialogShell` DEVE usar `endIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}`.
- O `disabled` de loading NÃO DEVE ser passado pelo consumidor no botão de submit — o `DialogShell` injeta via `cloneElement`. O consumidor só passa `disabled` para validação (ex: `disabled={!form.formState.isValid}`).
- O texto do botão NÃO DEVE mudar durante o submit.
- SE a abertura do dialog depende de carregamento de dados, O CORPO do dialog DEVE exibir `<Box sx={{ display: "flex", justifyContent: "center", py: layout.section }}><CircularProgress /></Box>` enquanto os dados não chegam.

**DESIGN-08 — `description` prop para confirmações simples:**
- Dialogs de confirmação com corpo apenas de texto (sem campos, sem `<Alert>`) DEVEM usar a prop `description` do `DialogShell` para o texto explicativo, deixando `children` sem a prop.
- Dialogs com conteúdo adicional (`<Alert>`, `<TextField>`) DEVEM manter tudo em `children`.

**D27 — MonthHeader com aviso de transações:**
- `MonthHeader` DEVE receber prop `hasTransactions: boolean`.
- O Server Component pai DEVE fazer a query para verificar se o mês tem transações e passar `hasTransactions` para `MonthHeader`.
- QUANDO `hasTransactions={true}` e o dialog de delete está aberto, O DIALOG DEVE exibir `<Alert severity="warning">{m.months.deleteWithTransactionsWarning}</Alert>` antes do `<TextField>` de confirmação.

---

## 5. Fora de Escopo

- Adição de novos dialogs ou modals que não existam atualmente no projeto.
- Redesign visual do `DialogShell` (bordas, cores, radius, tamanho mínimo) — o visual atual está correto e alinhado ao design system "Warm Calm".
- Implementação de animações de entrada/saída customizadas além das padrão do MUI.
- Dialogs de confirmação destrutiva para deleção de transações individuais — substituídos pelo padrão de undo via snackbar (Spec 20). O dialog de bulk delete (`BulkActionBar`) está em escopo pois ainda existe no código.
- Acessibilidade além da correção de `aria-labelledby` (ex: live regions, roles customizados) — o MUI já gerencia focus trap nativo.
- Migração de dialogs em páginas ou componentes fora de `src/` para o padrão `DialogShell`.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Nome da prop de loading | `loading` (não `isSubmitting`) | Mais genérico; `loading={isPending}` e `loading={deleting}` leem naturalmente em qualquer contexto, não apenas forms |
| `loading` vs callback `onBeforeClose` | Prop simples `loading` | Mais direto; não exige callback extra no consumidor |
| Gerenciamento do botão Cancelar | `DialogShell` injeta `disabled` via `React.cloneElement` em todos os `actions` | O consumidor não precisa lembrar de desabilitar o cancelar; `DialogShell` bloqueia todos os caminhos de saída uniformemente quando `loading={true}` |
| `description` como `ReactNode` | Ampliar de `string` para `ReactNode` | `ReactNode` engloba `string` — zero breaking change; habilita conteúdo rico sem wrapper extra. Convenção: passar string ou fragmento com inline elements, nunca `<Typography>` |
| Posição do `<form>` | Dentro do `children`, com `form={id}` no botão | Correto semanticamente no DOM real; evita portal crossing |
| Erro operacional | `<Alert severity="error">` no `children` | Visualmente distinto de erros de campo; usa componente do design system |
| Loading no botão | `endIcon` com `CircularProgress size={16}` | Já usado em `MoveTransactionsDialog` (correto); mantém largura do botão estável |
| Strings interpoladas em `messages/` | Funções inline no objeto `m` | Tipo heterogêneo (`string \| ((...args) => string)`); mais ergonômico que objeto separado; interpolação isolada no arquivo de mensagens |
| Remoção de `ariaLabel` | Remoção imediata com grep de auditoria | `aria-labelledby` + `useId()` é a abordagem correta; grep garante que nenhum consumidor quebra; sem período de deprecação |
| `description` em confirmações simples | Usar `description` no header | Texto curto de confirmação pertence ao cabeçalho semanticamente; `children` fica vazio para dialogs sem conteúdo adicional |
| Managers de settings | Em escopo desta spec | Possuem os mesmos problemas dos demais dialogs; consolidar numa única entrega evita dívida técnica fracionada |
| Aviso de transações em D27 | Nova prop `hasTransactions: boolean` no `MonthHeader` | Sem query extra no cliente; Server Component pai faz a verificação e passa o dado |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|------|-------------------|
| DLG-01 (loading, description, aria, cloneElement) | `src/components/ui/DialogShell.tsx` |
| DLG-02 (tokens de espaçamento) | `src/components/finance-tables/CreateTableModal.tsx`, `src/components/transactions/MoveTransactionsDialog.tsx`, `src/components/csv-import/ImportWizard.tsx`, `src/components/months/CreateMonthModal.tsx` |
| DLG-03 (composição de form) | `src/components/finance-tables/CreateTableModal.tsx`, `src/app/(app)/[accountId]/settings/sections/SectionsManager.tsx`, `src/components/members/InviteForm.tsx` |
| DLG-04 (Stack em vez de Box flex) | `src/components/months/CreateMonthModal.tsx` + todos listados em DESIGN-03 |
| DLG-05 (Alert de erro) | `src/components/months/CreateMonthModal.tsx` |
| DLG-06 (Typography, mensagens) | `src/components/transactions/MoveTransactionsDialog.tsx`, `src/lib/messages/pt-BR.ts` |
| DLG-07 (loading state) | `src/components/months/CreateMonthModal.tsx`, `src/components/finance-tables/CreateTableModal.tsx` + todos listados em DESIGN-05 |
| DESIGN-01 (maxWidth) | `src/components/transactions/BulkActionBar.tsx`, `src/components/finance-tables/FinanceTableCard.tsx`, `src/app/(app)/[accountId]/settings/models/TableModelsManager.tsx`, `src/components/members/MembersTable.tsx`, `src/app/(app)/[accountId]/settings/general/AccountDangerZone.tsx`, `src/components/months/MonthHeader.tsx` |
| DESIGN-02 (títulos genéricos) | `src/app/(app)/[accountId]/settings/categories/CategoriesManager.tsx`, `src/app/(app)/[accountId]/settings/institutions/InstitutionsManager.tsx`, `src/app/(app)/[accountId]/settings/sections/SectionsManager.tsx`, `src/app/(app)/[accountId]/settings/table-types/TableTypesManager.tsx`, `src/lib/messages/pt-BR.ts` |
| DESIGN-07 (strings hardcoded) | `src/lib/messages/pt-BR.ts` + todos os componentes listados |
| DESIGN-08 (description prop) | `src/app/(app)/[accountId]/settings/categories/CategoriesManager.tsx`, `src/app/(app)/[accountId]/settings/institutions/InstitutionsManager.tsx`, `src/app/(app)/[accountId]/settings/sections/SectionsManager.tsx`, `src/app/(app)/[accountId]/settings/templates/TemplatesManager.tsx`, `src/components/members/MembersTable.tsx` |
| D27 (hasTransactions) | `src/components/months/MonthHeader.tsx` + Server Component pai que o renderiza |

### Implementação de referência — `DialogShell` com `loading`, `cloneElement` e `aria-labelledby`

```tsx
// src/components/ui/DialogShell.tsx (trecho das mudanças)
import { useId, Children, cloneElement, isValidElement } from "react";

export interface DialogShellProps {
  // ...props existentes...
  description?: ReactNode;  // era string
  loading?: boolean;        // novo (era inexistente)
  // ariaLabel REMOVIDO — usar aria-labelledby nativo
}

export function DialogShell({ loading = false, description, actions, ...props }: DialogShellProps) {
  const titleId = useId();

  // Injeta disabled em todos os botões das actions quando loading
  const managedActions = loading && actions
    ? Children.map(actions, (child) =>
        isValidElement(child)
          ? cloneElement(child as React.ReactElement<{ disabled?: boolean }>, { disabled: true })
          : child
      )
    : actions;

  return (
    <Dialog
      aria-labelledby={titleId}
      disableEscapeKeyDown={loading}
      onClose={loading ? undefined : props.onClose}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box id={titleId}>
            <Typography variant="h3" component="div">{props.title}</Typography>
            {description && (
              <Typography variant="body2" sx={{ color: "text.secondary", mt: layout.micro }}>
                {description}
              </Typography>
            )}
          </Box>
          <IconButton onClick={props.onClose} disabled={loading} aria-label="Fechar">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>{props.children}</DialogContent>
      {managedActions && (
        <DialogActions>{managedActions}</DialogActions>
      )}
    </Dialog>
  );
}
```

### Padrão de composição de form em dialog (correto vs anti-padrão)

```tsx
// ✅ Correto — <form> dentro do children, botão usa form={id}
const FORM_ID = "create-table-form";

<DialogShell
  open={open}
  onClose={() => setOpen(false)}
  title={m.financeTables.createTitle}
  loading={form.formState.isSubmitting}
  actions={
    <>
      <Button onClick={() => setOpen(false)}>{m.common.cancel}</Button>
      <Button
        type="submit"
        form={FORM_ID}
        variant="contained"
        endIcon={
          form.formState.isSubmitting
            ? <CircularProgress size={16} color="inherit" />
            : undefined
        }
      >
        {m.common.create}
      </Button>
    </>
  }
>
  <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
    <Stack spacing={layout.stack}>
      <Controller name="name" ... />
      <Controller name="sectionId" ... />
    </Stack>
  </form>
</DialogShell>

// ❌ Anti-padrão atual — <form> fora do DialogShell (portal crossing)
<Box component="form" onSubmit={form.handleSubmit(onSubmit)}>
  <DialogShell actions={<Button type="submit">Criar</Button>}>
    {/* Conteúdo dentro do portal, semanticamente fora do <form> no DOM */}
  </DialogShell>
</Box>
```

### Padrão de erro operacional em dialog

```tsx
// ✅ Correto
<DialogShell ...>
  <Stack spacing={layout.stack}>
    {error && <Alert severity="error">{error}</Alert>}
    <TextField ... />
    <Select ... />
  </Stack>
</DialogShell>

// ❌ Anti-padrão atual
{error && (
  <Box sx={{ mt: 1, color: "error.main", typography: "body2" }}>{error}</Box>
)}
```

### Padrão de `description` para confirmações simples

```tsx
// ✅ Correto — texto de confirmação simples vai em description
<DialogShell
  open={open}
  onClose={onClose}
  maxWidth="xs"
  title={m.settings.categories.deleteTitle}
  description={m.settings.categories.deleteConfirm}
  actions={...}
/>

// ❌ Anti-padrão — children com só um <Typography>
<DialogShell ...>
  <Typography variant="body2">{m.settings.categories.deleteConfirm}</Typography>
</DialogShell>
```

### Padrão de strings interpoladas em `messages/`

```ts
// src/lib/messages/pt-BR.ts
// ✅ Correto — funções inline no objeto m
export const m = {
  financeTables: {
    moveSuccess: (n: number, name: string) => `${n} transação(ões) movida(s) para "${name}"`,
  },
  transactions: {
    bulkDeleteSuccess: (n: number) => `${n} transação(ões) deletada(s).`,
  },
  settings: {
    tableTypes: {
      deleteWarning: (n: number) => `Atenção: ${n} tabela(s) usam este tipo e precisarão ser atualizadas.`,
    },
  },
  // ...
}

// Uso no componente
enqueueSnackbar(m.financeTables.moveSuccess(count, tableName), { variant: "success" });
```

---

## 8. Revisão de Design — Inventário Completo de Dialogs

Mapeamento de todos os 27 dialogs/modais do projeto com problemas de design identificados por instância. Serve como checklist de execução para a implementação desta spec.

### 8.1 Mapa de dialogs

| # | Componente | Arquivo | Tipo | maxWidth |
|---|---|---|---|---|
| D01 | `DialogShell` | `src/components/ui/DialogShell.tsx` | Shell base | — |
| D02 | `CreateMonthModal` | `src/components/months/CreateMonthModal.tsx` | Form simples | `xs` |
| D03 | `CreateTableModal` | `src/components/finance-tables/CreateTableModal.tsx` | Form complexo multi-step | `sm` |
| D04 | `MoveTransactionsDialog` | `src/components/transactions/MoveTransactionsDialog.tsx` | Seleção cascata | `sm` |
| D05 | `TemplateItemsEditor` | `src/components/settings/TemplateItemsEditor.tsx` | Dialog grande com tabela | `md` |
| D06 | `ImportWizard` | `src/components/csv-import/ImportWizard.tsx` | Multi-step com Stepper | `md` |
| D07 | `BulkActionBar` → delete | `src/components/transactions/BulkActionBar.tsx` | Confirmação destrutiva | `xs` |
| D08 | `FinanceTableCard` → rename | `src/components/finance-tables/FinanceTableCard.tsx` | Form simples | `xs` |
| D09 | `FinanceTableCard` → delete | `src/components/finance-tables/FinanceTableCard.tsx` | Confirmação destrutiva | `xs` |
| D10 | `FinanceTableCard` → saveModel | `src/components/finance-tables/FinanceTableCard.tsx` | Form simples | `xs` |
| D11 | `CategoriesManager` → form | `src/app/.../settings/categories/CategoriesManager.tsx` | Form simples | `xs` |
| D12 | `CategoriesManager` → delete | `src/app/.../settings/categories/CategoriesManager.tsx` | Confirmação destrutiva | `xs` |
| D13 | `InstitutionsManager` → form | `src/app/.../settings/institutions/InstitutionsManager.tsx` | Form simples | `xs` |
| D14 | `InstitutionsManager` → delete | `src/app/.../settings/institutions/InstitutionsManager.tsx` | Confirmação destrutiva | `xs` |
| D15 | `SectionsManager` → form | `src/app/.../settings/sections/SectionsManager.tsx` | Form com RHF | `xs` |
| D16 | `SectionsManager` → delete | `src/app/.../settings/sections/SectionsManager.tsx` | Confirmação destrutiva | `xs` |
| D17 | `TableTypesManager` → create | `src/app/.../settings/table-types/TableTypesManager.tsx` | Form simples com RHF | `xs` |
| D18 | `TableTypesManager` → delete | `src/app/.../settings/table-types/TableTypesManager.tsx` | Confirmação destrutiva | `xs` |
| D19 | `TableModelsManager` → rename | `src/app/.../settings/models/TableModelsManager.tsx` | Form simples | `xs` |
| D20 | `TableModelsManager` → delete | `src/app/.../settings/models/TableModelsManager.tsx` | Confirmação destrutiva | `xs` |
| D21 | `TemplatesManager` → rename | `src/app/.../settings/templates/TemplatesManager.tsx` | Form simples | `xs` |
| D22 | `TemplatesManager` → delete | `src/app/.../settings/templates/TemplatesManager.tsx` | Confirmação destrutiva | `xs` |
| D23 | `MembersTable` → remove | `src/components/members/MembersTable.tsx` | Confirmação destrutiva | `xs` |
| D24 | `AccountDangerZone` → leave | `src/app/.../settings/general/AccountDangerZone.tsx` | Confirmação destrutiva | `xs` |
| D25 | `AccountDangerZone` → delete | `src/app/.../settings/general/AccountDangerZone.tsx` | Confirmação destrutiva + campo | `sm` |
| D26 | `InviteForm` | `src/components/members/InviteForm.tsx` | Form com RHF | `xs` |
| D27 | `MonthHeader` → delete | `src/components/months/MonthHeader.tsx` | Confirmação destrutiva + campo | `sm` |

---

### 8.2 Problemas de design por categoria

#### DESIGN-01 — `maxWidth` ausente ou incorreto em confirmações destrutivas

Dialogs de confirmação simples (texto + 2 botões) com `maxWidth` padrão `sm` (640px) ficam excessivamente largos. O padrão correto é `xs` (480px).

**Regra**: confirmações simples (título + texto + 2 botões) → `xs`. Confirmações com campo adicional ou `<Alert>` → `sm`.

| Dialog | Problema atual | Correção |
|---|---|---|
| D07 `BulkActionBar → delete` | Sem `maxWidth`, usa padrão `sm` | `maxWidth="xs"` |
| D08 `FinanceTableCard → rename` | Sem `maxWidth`, usa padrão `sm` | `maxWidth="xs"` |
| D09 `FinanceTableCard → delete` | Sem `maxWidth`, usa padrão `sm` | `maxWidth="xs"` |
| D20 `TableModelsManager → delete` | Sem `maxWidth` definido | `maxWidth="xs"` |
| D23 `MembersTable → remove` | Sem `maxWidth`, usa padrão `sm` | `maxWidth="xs"` |
| D24 `AccountDangerZone → leave` | Sem `maxWidth`, usa padrão `sm` | `maxWidth="xs"` |
| D25 `AccountDangerZone → delete` | Sem `maxWidth` explícito | `maxWidth="sm"` explícito (tem `<Alert>` + campo) |
| D27 `MonthHeader → delete` | Sem `maxWidth` explícito | `maxWidth="sm"` explícito (tem campo de confirmação) |

---

#### DESIGN-02 — Títulos de dialog genéricos e sem contexto

| Dialog | Título atual | Título correto |
|---|---|---|
| D11 `CategoriesManager → form` | `"Editar"` / `"Nova categoria"` | Manter "Nova categoria"; trocar "Editar" por `m.settings.categories.editTitle` = "Editar categoria" |
| D12 `CategoriesManager → delete` | `"Excluir"` | `m.settings.categories.deleteTitle` = "Excluir categoria" |
| D14 `InstitutionsManager → delete` | `"Excluir"` | `m.settings.institutions.deleteTitle` = "Excluir instituição" |
| D16 `SectionsManager → delete` | `"Excluir"` | `m.settings.sections.deleteTitle` = "Excluir seção" |
| D18 `TableTypesManager → delete` | `"Excluir"` | `m.settings.tableTypes.deleteTitle` = "Excluir tipo de coluna" |
| D20 `TableModelsManager → delete` | `"Deletar modelo"` (hardcoded) | `m.tableModels.deleteTitle` = "Excluir modelo" |
| D22 `TemplatesManager → delete` | `"Deletar template"` (hardcoded) | `m.templates.deleteTitle` = "Excluir template" |

---

#### DESIGN-03 — `Box flex` em vez de `Stack` em conteúdo de dialog

| Dialog | Localização exata | Correção |
|---|---|---|
| D02 `CreateMonthModal` | `<Box sx={{ display: "flex", gap: 2, pt: 1 }}>` | `<Stack direction="row" spacing={layout.inline} sx={{ pt: layout.micro }}>` |
| D15 `SectionsManager → form` | `<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>` | `<Stack spacing={layout.stack}>` |
| D17 `TableTypesManager → create` | `<Box component="form" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>` | `<form ...><Stack spacing={layout.stack}>` |
| D24 `AccountDangerZone → leave` | children sem Stack | adicionar `<Stack spacing={layout.stack}>` |
| D25 `AccountDangerZone → delete` | `<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>` | `<Stack spacing={layout.stack}>` |
| D26 `InviteForm` | `<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>` | `<Stack spacing={layout.stack}>` |
| D27 `MonthHeader → delete` | `<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>` | `<Stack spacing={layout.stack}>` |

---

#### DESIGN-04 — `<form>` fora do portal `DialogShell` (portal crossing)

| Dialog | Padrão atual | Correção |
|---|---|---|
| D03 `CreateTableModal` | `<Box component="form">` envolve `<DialogShell>` | Mover `<form id="create-table-form">` para dentro do `children`; usar `form="create-table-form"` no botão |
| D15 `SectionsManager → form` | `<Box component="form">` envolve `<DialogShell>` | Mover `<form id="sections-form">` para dentro do `children`; usar `form="sections-form"` no botão |
| D26 `InviteForm` | `<Box component="form">` envolve `<DialogShell>` | Mover `<form id="invite-form">` para dentro do `children`; usar `form="invite-form"` no botão |

---

#### DESIGN-05 — Loading state incompleto ou anti-padrão

| Dialog | Estado atual | Correção |
|---|---|---|
| D08 `FinanceTableCard → rename` | Sem `disabled` no botão de salvar | Passar `loading={isPending}` ao `DialogShell`; adicionar `endIcon` com `CircularProgress` |
| D10 `FinanceTableCard → saveModel` | `disabled={isPending || !modelName.trim()}` sem spinner | Passar `loading={isPending}`; `disabled={!modelName.trim()}` para validação; adicionar `endIcon` |
| D11 `CategoriesManager → form` | `disabled={isPending}` sem spinner | Passar `loading={isPending}`; adicionar `endIcon` |
| D13 `InstitutionsManager → form` | `disabled` sem spinner | Passar `loading={isPending}`; adicionar `endIcon` |
| D15 `SectionsManager → form` | `disabled={form.formState.isSubmitting}` sem spinner | Passar `loading={form.formState.isSubmitting}`; adicionar `endIcon` |
| D17 `TableTypesManager → create` | `disabled={form.formState.isSubmitting}` sem spinner | Passar `loading={form.formState.isSubmitting}`; adicionar `endIcon` |
| D26 `InviteForm` | Texto muda para `"Enviando..."` (anti-padrão) | Manter texto fixo; passar `loading={form.formState.isSubmitting}`; usar `endIcon` com `CircularProgress` |

---

#### DESIGN-06 — Feedback de warning/erro via `<Typography>` em vez de `<Alert>`

| Dialog | Problema | Correção |
|---|---|---|
| D18 `TableTypesManager → delete` | `<Typography color="error">` para warning | `<Alert severity="warning">{m.settings.tableTypes.deleteWarning(n)}</Alert>` |
| D02 `CreateMonthModal` | `<Box sx={{ color: "error.main" }}>` para erro | `<Alert severity="error">` |
| D27 `MonthHeader → delete` | Sem Alert para mês com transações | `{hasTransactions && <Alert severity="warning">{m.months.deleteWithTransactionsWarning}</Alert>}` antes do `<TextField>` |

---

#### DESIGN-07 — Strings hardcoded fora de `messages/`

| Dialog | String hardcoded | Chave a criar |
|---|---|---|
| D04 `MoveTransactionsDialog` | `"CONFIGURAR NOVA TABELA"` | `m.financeTables.moveNewTableSection` |
| D04 `MoveTransactionsDialog` | `` `${N} transação(ões) movida(s) para "${name}"` `` | `m.financeTables.moveSuccess: (n, name) => string` |
| D07 `BulkActionBar` | `` `${count} transação(ões) deletada(s).` `` | `m.transactions.bulkDeleteSuccess: (n) => string` |
| D10 `FinanceTableCard → saveModel` | `"Salvar modelo"` (botão) | `m.tableModels.saveModelButton` |
| D10 `FinanceTableCard → saveModel` | `"As transações atuais serão salvas como itens do modelo."` | `m.tableModels.saveModelHelperText` |
| D17 `TableTypesManager → create` | `"As colunas visíveis podem ser configuradas após criar o tipo."` | `m.settings.tableTypes.createHelperText` |
| D18 `TableTypesManager → delete` | `` `Atenção: ${N} tabela(s) usam este tipo.` `` | `m.settings.tableTypes.deleteWarning: (n) => string` |
| D19 `TableModelsManager → rename` | `"Renomear modelo"` | `m.tableModels.renameTitle` |
| D20 `TableModelsManager → delete` | `"Deletar modelo"` | `m.tableModels.deleteTitle` = "Excluir modelo" |
| D21 `TemplatesManager → rename` | `"Renomear template"` | `m.templates.renameTitle` |
| D22 `TemplatesManager → delete` | `"Deletar template"` | `m.templates.deleteTitle` = "Excluir template" |
| D27 `MonthHeader → delete` | (aviso de transações) | `m.months.deleteWithTransactionsWarning` |

---

#### DESIGN-08 — `description` prop subutilizada

Dialogs de confirmação com corpo apenas de `<Typography variant="body2">` devem usar `description` no header.

| Dialog | Situação atual | Melhoria |
|---|---|---|
| D12 `CategoriesManager → delete` | `children`: só `<Typography>` | `description={m.settings.categories.deleteConfirm}` — sem `children` |
| D14 `InstitutionsManager → delete` | Idem | `description={m.settings.institutions.deleteConfirm}` |
| D16 `SectionsManager → delete` | Idem | `description={m.settings.sections.deleteConfirm}` |
| D22 `TemplatesManager → delete` | Idem | `description={m.templates.deleteConfirm}` |
| D23 `MembersTable → remove` | Idem | `description={m.account.members.removeConfirm}` |

**Exceções que mantêm `children`**: D18 (tem `<Alert>`), D25 e D27 (têm `<TextField>`).

---

#### DESIGN-09 — `fontWeight="bold"` e uso incorreto de Typography

| Dialog | Ocorrência | Correção |
|---|---|---|
| D04 `MoveTransactionsDialog` | `<Typography fontWeight="bold">CONFIGURAR NOVA TABELA</Typography>` | `<Typography variant="overline" color="text.secondary">Configurar nova tabela</Typography>` |
| D05 `TemplateItemsEditor` | `<TableCell sx={{ fontWeight: "bold" }}>` em cabeçalho | Remover `fontWeight` — o tema já define `TableHead` cell como bold |
| D06 `ImportWizard` | Verificar e corrigir ocorrências de `fontWeight="bold"` | Usar variante tipográfica correta |

---

### 8.3 Resumo de prioridades

| Prioridade | IDs | Justificativa |
|---|---|---|
| 🔴 Alta (fazer primeiro) | DLG-01 — DialogShell | Pré-requisito para tudo: `loading`, `cloneElement`, `aria-labelledby`, `description as ReactNode` |
| 🔴 Alta | DESIGN-04 (portal crossing) | Semanticamente incorreto; pode quebrar em edge cases de navegador |
| 🔴 Alta | DESIGN-03 (Box flex → Stack) | Anti-padrão explícito no design system |
| 🟡 Média | DESIGN-01 (maxWidth) | Dialogs excessivamente largos para confirmações simples |
| 🟡 Média | DESIGN-05 (loading state) | Inconsistência de UX: alguns dialogs têm spinner, outros não |
| 🟡 Média | DESIGN-06 (Alert vs Typography error) | Feedback de erro/warning inconsistente |
| 🟢 Baixa | DESIGN-02 (títulos genéricos) | Impacto na clareza para o usuário |
| 🟢 Baixa | DESIGN-07 (strings hardcoded) | Apenas organização; não afeta visual |
| 🟢 Baixa | DESIGN-08 (description prop) | Melhoria de hierarquia; não é bug |
| 🟢 Baixa | DESIGN-09 (fontWeight bold) | Viola design system; impacto visual menor |
