# SKILL — Server Actions

## Quando usar

Toda Server Action do projeto. **Sem exceção.** Este skill define o padrão único de retorno, validação, autorização e tratamento de erros.

## Princípio

**Server Actions são apenas transporte.** Validam input, checam auth, chamam um service, retornam resposta padronizada. **Nada de lógica de negócio aqui.**

## O tipo de retorno: `ActionResult<T>`

```ts
// src/lib/action-result.ts

export type ActionErrorCode =
  | "VALIDATION"      // input não passou no Zod
  | "UNAUTHORIZED"    // não está logado
  | "FORBIDDEN"       // logado mas sem permissão
  | "NOT_FOUND"       // recurso não existe
  | "CONFLICT"        // violação de regra (ex: email duplicado)
  | "INTERNAL";       // erro inesperado

export type ActionSuccess<T> = {
  ok: true;
  data: T;
};

export type ActionFailure = {
  ok: false;
  error: {
    code: ActionErrorCode;
    message: string;
    fieldErrors?: Record<string, string>;
  };
};

export type ActionResult<T = void> = ActionSuccess<T> | ActionFailure;

// Helpers
export function actionSuccess<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

export function actionError(
  code: ActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): ActionFailure {
  return { ok: false, error: { code, message, fieldErrors } };
}
```

## Hierarquia de erros no servidor (lançados por services)

Services **lançam** erros tipados; o wrapper da action converte para `ActionResult`.

```ts
// src/server/api/errors.ts

export class AppError extends Error {
  constructor(
    public code: ActionErrorCode,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super("NOT_FOUND", `${resource}${id ? ` (${id})` : ""} não encontrado`);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Você não tem permissão para esta ação") {
    super("FORBIDDEN", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super("CONFLICT", message, fieldErrors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Você precisa estar logado") {
    super("UNAUTHORIZED", message);
  }
}
```

## Padrão obrigatório: helper `defineAction`

Em vez de boilerplate em cada action, use um helper que encapsula validação, auth, error handling e logging.

```ts
// src/server/api/define-action.ts

import { z } from "zod";

import { logger } from "@/server/logger";
import {
  type ActionResult,
  actionError,
  actionSuccess,
} from "@/lib/action-result";
import { AppError } from "@/server/api/errors";
import { requireUser, requireAccountAccess } from "@/server/auth/session";
import type { AccountMemberRole } from "@prisma/client";

type ActionContext = {
  userId: string;
  accountId: string;
  role: AccountMemberRole;
};

type DefineActionConfig<TInput, TOutput> = {
  schema: z.ZodType<TInput>;
  requireRoles?: AccountMemberRole[]; // se omitido, qualquer membro pode
  handler: (input: TInput, ctx: ActionContext) => Promise<TOutput>;
};

export function defineAction<TInput, TOutput>(
  config: DefineActionConfig<TInput, TOutput>,
) {
  return async (
    accountId: string,
    rawInput: unknown,
  ): Promise<ActionResult<TOutput>> => {
    try {
      // 1. Auth
      const { user, member } = await requireAccountAccess(accountId);

      // 2. Role check
      if (config.requireRoles && !config.requireRoles.includes(member.role)) {
        return actionError(
          "FORBIDDEN",
          "Seu papel não permite esta ação",
        );
      }

      // 3. Validação Zod
      const parsed = config.schema.safeParse(rawInput);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const path = issue.path.join(".");
          if (path && !fieldErrors[path]) {
            fieldErrors[path] = issue.message;
          }
        }
        return actionError("VALIDATION", "Dados inválidos", fieldErrors);
      }

      // 4. Handler
      const ctx: ActionContext = {
        userId: user.id,
        accountId,
        role: member.role,
      };
      const result = await config.handler(parsed.data, ctx);
      return actionSuccess(result);
    } catch (error) {
      // 5. Erros tipados → ActionResult correspondente
      if (error instanceof AppError) {
        return actionError(error.code, error.message, error.fieldErrors);
      }

      // 6. Erro inesperado → log + INTERNAL
      logger.error({ err: error, accountId }, "Server action failed");
      return actionError("INTERNAL", "Erro inesperado. Tente novamente.");
    }
  };
}
```

## Uso

### Definir action

```ts
// src/actions/transactions.ts
"use server";

import { revalidatePath } from "next/cache";

import { createTransactionSchema } from "@/lib/schemas/transaction";
import { defineAction } from "@/server/api/define-action";
import { transactionService } from "@/server/services/transaction-service";

export const createTransactionAction = defineAction({
  schema: createTransactionSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    const transaction = await transactionService.create({
      ...input,
      accountId: ctx.accountId,
      createdById: ctx.userId,
    });
    revalidatePath(`/[accountId]/months/[monthId]`, "page");
    return { id: transaction.id };
  },
});
```

### Chamar no client

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSnackbar } from "notistack";

import { transactionFormSchema } from "@/lib/schemas/transaction";
import { createTransactionAction } from "@/actions/transactions";

export function TransactionForm({ accountId, tableId }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const form = useForm({
    resolver: zodResolver(transactionFormSchema),
  });

  async function onSubmit(values) {
    const result = await createTransactionAction(accountId, { ...values, tableId });

    if (result.ok) {
      enqueueSnackbar("Transação criada", { variant: "success" });
      form.reset();
      return;
    }

    // Field errors → atribuir ao form
    if (result.error.fieldErrors) {
      Object.entries(result.error.fieldErrors).forEach(([field, message]) => {
        form.setError(field as any, { message });
      });
      return;
    }

    // Erro geral → toast
    enqueueSnackbar(result.error.message, { variant: "error" });
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>;
}
```

## Helper para o client: `useActionState` pattern

Para reduzir boilerplate de tratamento de erros, considere um hook custom:

```ts
// src/lib/hooks/use-action.ts
"use client";
import { useState, useTransition } from "react";

import { useSnackbar } from "notistack";
import type { ActionResult } from "@/lib/action-result";

export function useAction<TInput, TOutput>(
  action: (accountId: string, input: TInput) => Promise<ActionResult<TOutput>>,
) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const execute = (accountId: string, input: TInput, options?: {
    onSuccess?: (data: TOutput) => void;
    successMessage?: string;
  }) => {
    startTransition(async () => {
      const result = await action(accountId, input);
      if (result.ok) {
        setFieldErrors({});
        if (options?.successMessage) {
          enqueueSnackbar(options.successMessage, { variant: "success" });
        }
        options?.onSuccess?.(result.data);
      } else {
        if (result.error.fieldErrors) {
          setFieldErrors(result.error.fieldErrors);
        } else {
          enqueueSnackbar(result.error.message, { variant: "error" });
        }
      }
    });
  };

  return { execute, isPending, fieldErrors };
}
```

## Pitfall: `.default()` em schemas aninhados

Quando um schema Zod tem campos com `.default()` dentro de objetos aninhados usados em `defineAction`, TypeScript às vezes infere `TInput` como o tipo INPUT (com campos opcionais) em vez do tipo OUTPUT (com campos required). Isso causa erro de tipo ao passar o `input` do handler para o service.

**Sintoma**:
```ts
// schema tem: mapping: z.object({ dateFormat: z.string().default("DD/MM/YYYY"), ... })
// Erro: "dateFormat?: string | undefined" não é atribuível a "dateFormat: string"
```

**Solução**:
```ts
// ❌ Errado — z.infer<> pode não refletir corretamente para TInput
export type MyInput = z.infer<typeof mySchema>;

// ✅ Certo — exportar com z.input<> para que o tipo bata com o que defineAction infere
export type MyInput = z.input<typeof mySchema>;

// ✅ No service, normalizar para garantir defaults antes de usar:
const normalized = myNestedSchema.parse(input.nested); // preenche defaults
// A partir daqui, normalized tem o tipo output (campos required)
```

> **Por quê acontece**: `defineAction` usa `schema: z.ZodType<TInput>` onde o primeiro parâmetro é o tipo OUTPUT. Mas para schemas com objetos aninhados e `.default()`, TypeScript às vezes não consegue propagar corretamente o tipo output dos campos nested, inferindo o tipo input em vez disso. A solução com `z.input<>` + `schema.parse()` no service é pragmática e segura.

## Anti-patterns

❌ Action retornando erro como `throw` (cliente recebe Error genérico, sem código)
❌ Action retornando `null` em erro
❌ Action sem `requireAccountAccess` no início
❌ Lógica de negócio dentro da action (deve estar em service)
❌ Action recebendo `accountId` mas não usando — sempre passar pro service
❌ Validação só no client — Server Action **sempre** revalida
❌ Mensagens de erro técnicas para o usuário ("Prisma error P2002") — traduzir para mensagem humana
❌ Usar `z.infer<>` em tipos de action quando o schema tem `.default()` em objetos aninhados — usar `z.input<>`

## Checklist

- [ ] Action usa `defineAction` (não cria a função do zero).
- [ ] Schema Zod definido em `src/lib/schemas/`, importado.
- [ ] `requireRoles` declarado se a operação muta dados.
- [ ] Handler chama um service, não acessa `prisma` direto.
- [ ] `revalidatePath` chamado se a UI precisa refletir mudança.
- [ ] Se schema tem `.default()` em nested objects, usar `z.input<>` para tipos exportados.
- [ ] Client trata `result.ok` antes de acessar `result.data`.
- [ ] Field errors do retorno são atribuídos ao RHF.
