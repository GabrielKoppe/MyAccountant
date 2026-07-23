# SKILL — Forms com Zod + React Hook Form

## Quando usar

Toda vez que criar um formulário no app. Sem exceção. O padrão garante validação consistente entre client e server, mensagens de erro em pt-BR e DX agradável.

## Princípio

**Um único schema Zod por entidade serve para tudo**: validação no React Hook Form (client), validação na Server Action (server) e inferência de tipos TypeScript.

## Estrutura de pastas

```
src/lib/schemas/
├── transaction.ts        — schemas de Transaction
├── finance-table.ts      — schemas de FinanceTable
├── account.ts            — schemas de Account, Member, Invite
├── section.ts            — schemas de Section
├── category.ts           — schemas de Category/Subcategory
├── csv-import.ts         — schemas de import
└── shared.ts             — schemas reutilizáveis (cuid, amount, etc.)
```

## Schema padrão

```ts
// src/lib/schemas/transaction.ts
import { z } from "zod";

// Schema base — só a forma do dado
export const transactionFormSchema = z.object({
  occurredOn: z.coerce.date({ message: "Data inválida" }),
  amountCents: z.coerce.bigint({ message: "Valor inválido" }),
  description: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  isPending: z.boolean().default(false),
  isFavorite: z.boolean().default(false),
  categoryId: z.string().cuid().nullable().optional(),
  subcategoryId: z.string().cuid().nullable().optional(),
  institutionId: z.string().cuid().nullable().optional(),
  institutionText: z.string().max(80).optional(),
  responsibleUserId: z.string().cuid().nullable().optional(),
  cardInstallment: z.string().regex(/^\d+\/\d+$/, "Formato: 3/12").optional(),
  investmentType: z.string().max(40).optional(),
});

// Schema para criar — adiciona o que falta
export const createTransactionSchema = transactionFormSchema.extend({
  tableId: z.string().cuid(),
});

// Schema para atualizar — tudo opcional
export const updateTransactionSchema = transactionFormSchema.partial();

// Tipos inferidos (não precisa duplicar manualmente)
export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
```

## Uso no client (React Hook Form)

```tsx
// src/components/transactions/TransactionForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionFormSchema, type TransactionFormValues } from "@/lib/schemas/transaction";
import { createTransactionAction } from "@/actions/transactions";

export function TransactionForm({ accountId, tableId }: Props) {
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      occurredOn: new Date(),
      amountCents: 0n,
      isPending: false,
      isFavorite: false,
    },
  });

  async function onSubmit(values: TransactionFormValues) {
    const result = await createTransactionAction(accountId, { ...values, tableId });
    if (result.error) {
      // Trata erros por campo (de Zod no server) ou erro geral
      if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([field, message]) => {
          form.setError(field as any, { message });
        });
      } else {
        toast.error(result.error);
      }
    } else {
      toast.success("Transação criada");
      form.reset();
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* campos */}
      </form>
    </Form>
  );
}
```

## Uso no server (Server Action)

```ts
// src/actions/transactions.ts
"use server";

import { createTransactionSchema } from "@/lib/schemas/transaction";
import { requireAccountAccess } from "@/lib/auth/session";

type ActionResult<T = unknown> =
  | { data: T; error?: never; fieldErrors?: never }
  | { error: string; data?: never; fieldErrors?: Record<string, string> };

export async function createTransactionAction(
  accountId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await requireAccountAccess(accountId);

    // Re-validar no server — nunca confiar só no client
    const parsed = createTransactionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error: "Dados inválidos",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      };
    }

    const tx = await prisma.transaction.create({
      data: { ...parsed.data, accountId, createdById: user.id },
    });

    revalidatePath(`/[accountId]/months/[monthId]`);
    return { data: { id: tx.id } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
```

## Mensagens em português

Configure mensagens de erro padrão do Zod em pt-BR:

```ts
// src/lib/zod-config.ts
import { z } from "zod";

z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case "invalid_type":
      if (issue.expected === "string") return { message: "Campo obrigatório" };
      if (issue.expected === "number") return { message: "Deve ser um número" };
      if (issue.expected === "date") return { message: "Data inválida" };
      break;
    case "too_small":
      if (issue.type === "string") {
        return { message: `Mínimo de ${issue.minimum} caracteres` };
      }
      if (issue.type === "number") {
        return { message: `Valor mínimo: ${issue.minimum}` };
      }
      break;
    case "too_big":
      if (issue.type === "string") {
        return { message: `Máximo de ${issue.maximum} caracteres` };
      }
      break;
    case "invalid_string":
      if (issue.validation === "email") return { message: "Email inválido" };
      if (issue.validation === "url") return { message: "URL inválida" };
      break;
  }
  return { message: ctx.defaultError };
});
```

Importar uma vez em `src/app/layout.tsx` ou em um root provider.

## Validação cruzada (cross-field)

Use `.refine` ou `.superRefine` para regras entre campos:

```ts
const transactionWithSubcategoryCheck = createTransactionSchema.refine(
  (data) => {
    if (data.subcategoryId && !data.categoryId) return false;
    return true;
  },
  { message: "Subcategoria requer categoria", path: ["subcategoryId"] }
);
```

> Validação que depende do DB (ex: "subcategory pertence à category") roda **só no server** com query Prisma. Não fazer no Zod schema compartilhado.

## Defaults inteligentes

```ts
const sectionSchema = z.object({
  name: z.string().min(1).max(40),
  countType: z.enum(["add", "subtract", "ignore", "neutral"]).default("subtract"),
  order: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
```

## Transformações

```ts
const emailSchema = z.string().email().toLowerCase().trim();

const slugSchema = z.string().transform((s) => s.toLowerCase().replace(/\s+/g, "-"));

// Coerção
const numberFromString = z.coerce.number();
const dateFromString = z.coerce.date();
const bigIntFromAnything = z.coerce.bigint();
```

## Schemas reutilizáveis

```ts
// src/lib/schemas/shared.ts

export const cuidSchema = z.string().cuid({ message: "ID inválido" });
export const emailSchema = z.string().email().toLowerCase().trim();
export const dateSchema = z.coerce.date();
export const amountCentsSchema = z.coerce.bigint();
export const positiveAmountSchema = amountCentsSchema.refine((v) => v > 0n, {
  message: "Deve ser maior que zero",
});
```

## Componentes Material UI

Componentes MUI **gerenciam state próprio**, então usar via `Controller` do RHF (não `register`).

```tsx
import { Controller } from "react-hook-form";
import { TextField } from "@mui/material";

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
```

> Padrões completos de integração MUI + RHF (Select, DatePicker, NumericFormat, Switch) em `skills/mui-patterns/SKILL.md`.

## Edição inline (tabelas)

Para edição célula a célula na FinanceTable, não use form completo. Use schema parcial e mutate por campo:

```tsx
async function handleCellEdit(transactionId: string, field: string, value: unknown) {
  const partial = { [field]: value };
  const parsed = updateTransactionSchema.pick({ [field]: true }).safeParse(partial);
  if (!parsed.success) {
    toast.error(parsed.error.errors[0].message);
    return;
  }
  await updateTransactionAction(accountId, transactionId, parsed.data);
}
```

## Id opcional vindo de `<Select>`/Autocomplete → aceite `""` como "ausente"

`z.string().cuid().optional()` **só ignora `undefined`**. Um `<Select>` do MUI com
uma opção "Nenhum" (`<MenuItem value="">`) ou um Autocomplete limpo entrega **`""`**
(string vazia) — que cai no `.cuid()` e falha com **"ID inválido"**. Sintoma: o form
não submete (silencioso se o campo não tem slot de erro visível) ou mostra "ID inválido"
numa dimensão que o usuário nem preencheu. Bug real nos forms de Meta/Orçamento.

Normalize "vazio" → ausência **no schema** (fonte única — vale client + server), nunca
só no `onChange` do componente. Helpers prontos em `src/lib/schemas/shared.ts`:

```ts
// string | undefined  (quando "sem valor" = undefined)
export const optionalDimensionId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  cuidSchema.optional(),
);
// string | null | undefined  (quando "sem valor" = null)
export const optionalDimensionIdNullable = z.preprocess(
  (v) => (v === "" ? null : v),
  cuidSchema.optional().nullable(),
);
```

Para **arrays** de ids (multi-select), normalize antes de validar cada elemento:

```ts
const dimIds = z.preprocess(
  (v) => (Array.isArray(v) ? [...new Set(v.filter(Boolean))] : []), // tira "" e duplicados
  z.array(cuidSchema).default([]),
);
```

## Anti-patterns

❌ `z.string().cuid().optional()` num id que vem de `<Select>` — `""` vira "ID inválido" (use os helpers acima)
❌ Duplicar tipos: criar uma interface manual + schema Zod separados
❌ Validar só no client (server confia no input)
❌ Validar só no server (UX ruim, sem feedback inline)
❌ Mensagens em inglês para usuário final em pt-BR
❌ Schemas espalhados pelos componentes (sempre em `src/lib/schemas/`)
❌ Coerções implícitas no form (use `z.coerce.*` explícito)
