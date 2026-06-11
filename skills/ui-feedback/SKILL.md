# Skill: UI Feedback

> Padrões para exibir feedback de Server Actions na UI: loading, erros inline, toasts e o hook utilitário `useActionFeedback`.

---

## Quando usar

Sempre que um componente chamar uma Server Action e precisar responder ao `ActionResult` — seja um form, um botão de ação rápida, ou uma operação em lote.

---

## 1. Setup — notistack já está configurado

O `SnackbarProvider` já está em [src/components/providers/AppProviders.tsx](src/components/providers/AppProviders.tsx):

```tsx
<SnackbarProvider
  maxSnack={3}
  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
  autoHideDuration={4000}   // 4s — padrão para todos os toasts
>
```

Não é necessário configurar nada. Apenas importar `useSnackbar` de `"notistack"`.

---

## 2. Regra de decisão: inline vs snackbar

| Situação | Onde mostrar |
|---|---|
| Erro aponta para um campo específico (`result.error.fieldErrors`) | **Inline no campo** — via `setErrors` ou RHF `setError` |
| Erro genérico de sistema (`INTERNAL`, `NOT_FOUND`, `CONFLICT`) | **Snackbar** — `enqueueSnackbar(message, { variant: "error" })` |
| Sucesso de qualquer operação | **Snackbar** — `variant: "success"` |
| Aviso não bloqueante (ex: validação de wizard) | **Snackbar** — `variant: "warning"` |

Quando há `fieldErrors`, mostrar inline **e** snackbar com a mensagem genérica — o snackbar serve de âncora visual para o usuário perceber que houve erro, o campo mostra o detalhe.

---

## 3. Estado de loading — botão de submit

Durante uma action em andamento, o botão de submit deve:
- Ficar `disabled`
- Substituir o label por `<CircularProgress size={20} />` (botão não muda de tamanho)

```tsx
<Button
  variant="contained"
  onClick={handleSubmit}
  disabled={isPending}
>
  {isPending ? <CircularProgress size={20} /> : "Salvar"}
</Button>
```

---

## 4. Quando usar `useTransition` vs `useActionState`

| Caso | Hook |
|---|---|
| Ação sem form: botão de delete, toggle, reorder, bulk | `useTransition` |
| Form com campos controlados + `defineAction` | `useTransition` |
| Form com `<form action={serverAction}>` nativo (sem `defineAction`) | `useActionState` |

### 4a. `useTransition` — padrão para ações e forms com `defineAction`

```tsx
const { enqueueSnackbar } = useSnackbar();
const [isPending, startTransition] = useTransition();

function handleSubmit() {
  startTransition(async () => {
    const result = await minhAction(accountId, payload);

    if (!result.ok) {
      if (result.error.fieldErrors) setErrors(result.error.fieldErrors);
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }

    enqueueSnackbar(m.meuModulo.salvo, { variant: "success" });
    onSuccess();
  });
}
```

### 4b. `useActionState` — apenas para `<form action={}>` nativo

```tsx
import { useActionState } from "react";

const [state, formAction, isPending] = useActionState(
  async (prevState: ActionResult | null, formData: FormData) => {
    return await minhaNativeAction(formData);
  },
  null,
);

return (
  <form action={formAction}>
    {state && !state.ok && (
      <Alert severity="error">{state.error.message}</Alert>
    )}
    <TextField name="email" />
    <Button type="submit" disabled={isPending}>
      {isPending ? <CircularProgress size={20} /> : "Entrar"}
    </Button>
  </form>
);
```

> `useActionState` só faz sentido com `<form action={...}>` nativo. Para forms controlados com `defineAction`, usar `useTransition`.

---

## 5. Hook utilitário `useActionFeedback`

Para evitar repetir o padrão `if (!result.ok) { setErrors / enqueueSnackbar }` em cada componente, criar o hook em [src/hooks/useActionFeedback.ts](src/hooks/useActionFeedback.ts):

```typescript
// src/hooks/useActionFeedback.ts
"use client";

import { useSnackbar } from "notistack";
import type { ActionResult } from "@/lib/action-result";

type Options<T> = {
  onSuccess?: (data: T) => void;
  onFieldError?: (fieldErrors: Record<string, string>) => void;
  successMessage?: string;
};

export function useActionFeedback<T>(options: Options<T> = {}) {
  const { enqueueSnackbar } = useSnackbar();

  function handle(result: ActionResult<T>) {
    if (!result.ok) {
      if (result.error.fieldErrors && options.onFieldError) {
        options.onFieldError(result.error.fieldErrors);
      }
      enqueueSnackbar(result.error.message, { variant: "error" });
      return false;
    }

    if (options.successMessage) {
      enqueueSnackbar(options.successMessage, { variant: "success" });
    }
    options.onSuccess?.(result.data);
    return true;
  }

  return { handle };
}
```

**Uso no componente:**

```tsx
const [isPending, startTransition] = useTransition();
const { handle } = useActionFeedback({
  successMessage: m.budgets.created,
  onFieldError: setErrors,
  onSuccess: (data) => { onClose(); router.refresh(); },
});

function handleSubmit() {
  startTransition(async () => {
    const result = await createBudgetAction(accountId, payload);
    handle(result);
  });
}
```

---

## 6. Variantes de snackbar

```tsx
const { enqueueSnackbar } = useSnackbar();

enqueueSnackbar("Salvo com sucesso", { variant: "success" });   // 4s auto-dismiss
enqueueSnackbar("Falha ao salvar", { variant: "error" });       // 4s auto-dismiss
enqueueSnackbar("Atenção: limite próximo", { variant: "warning" });
enqueueSnackbar("Importação iniciada", { variant: "info" });

// Com ação (ex: desfazer)
enqueueSnackbar("Transação excluída", {
  variant: "default",
  action: (key) => (
    <Button color="inherit" size="small" onClick={() => handleUndo(key)}>
      Desfazer
    </Button>
  ),
});
```

Duração global é 4s (configurada no provider). Para persistir até fechar manualmente:

```tsx
enqueueSnackbar("Erro crítico — contate o suporte", {
  variant: "error",
  persist: true,
});
```

---

## 7. Mensagens de erro — sempre de `messages/pt-BR.ts`

```tsx
// ❌ String hardcoded
enqueueSnackbar("Erro ao salvar", { variant: "error" });

// ✅ Via messages
enqueueSnackbar(m.meuModulo.saveError, { variant: "error" });
```

---

## Anti-padrões

| ❌ Não fazer | ✅ Fazer |
|---|---|
| `useState<{open: boolean; error?: boolean}>` + `<Snackbar>` local | `useSnackbar()` de notistack |
| Snackbar para erro de campo específico | Erro inline no campo (`setErrors` / `setError` RHF) |
| Snackbar para informação crítica que o usuário precisa ler | `<Alert>` inline ou `<Dialog>` |
| `disabled={loading}` com CircularProgress ao lado do botão | Label substituído por `<CircularProgress size={20} />` |
| `useState<boolean>` para loading de action | `useTransition` (dá `isPending` automaticamente) |
| String de mensagem hardcoded | `m.modulo.chave` de `@/lib/messages` |
| `console.error(err)` no catch | Logger Pino no servidor; snackbar para o usuário |
