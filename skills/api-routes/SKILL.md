# Skill: API Route Handlers

> Padrões para criar Route Handlers REST sob `/api/v1/`, incluindo auth, tratamento de erros, OpenAPI e o wrapper `defineRoute`.

---

## Quando usar

Sempre que criar ou modificar um endpoint REST em `src/app/api/v1/`. Rotas internas (`/api/auth/`, `/api/health`) não seguem este padrão.

---

## 1. Arquitetura

Route Handlers são transporte — a lógica de negócio fica no **service** correspondente, compartilhado com Server Actions:

```
UI / cliente externo
      ↓
Route Handler  ←→  Service  ←→  Prisma
      ↑
Server Action
```

Um handler fino não deve conter nada além de: autenticação, extração de params, chamada ao service, serialização da resposta.

---

## 2. `defineRoute` — wrapper padrão

Análogo ao `defineAction`, o `defineRoute` centraliza: validação de auth, mapeamento de `AppError` → HTTP status, e o formato de resposta.

**Criar o arquivo** [src/server/api/route-helpers.ts](src/server/api/route-helpers.ts):

```typescript
// src/server/api/route-helpers.ts
import { ZodSchema } from "zod";
import { AppError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { actionSuccess, actionError } from "@/lib/action-result";

const ERROR_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN:    403,
  NOT_FOUND:    404,
  CONFLICT:     409,
  VALIDATION:   422,
  INTERNAL:     500,
};

type RouteContext = { params: Promise<Record<string, string>> };

export function defineRoute<TInput, TOutput>(opts: {
  schema?: ZodSchema<TInput>;
  handler: (input: TInput, params: Record<string, string>) => Promise<TOutput>;
  module: string;
}) {
  return async (req: Request, ctx: RouteContext): Promise<Response> => {
    const params = await ctx.params;
    const log = logger.child({ module: opts.module, params });

    try {
      let input = {} as TInput;

      if (opts.schema) {
        const body = req.method !== "GET" ? await req.json().catch(() => ({})) : {};
        const parsed = opts.schema.safeParse({ ...params, ...body });
        if (!parsed.success) {
          return Response.json(
            actionError("VALIDATION", "Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string>),
            { status: 422 },
          );
        }
        input = parsed.data;
      }

      const data = await opts.handler(input, params);
      return Response.json(actionSuccess(data));
    } catch (err) {
      if (err instanceof AppError) {
        const status = ERROR_STATUS[err.code] ?? 500;
        log.warn({ code: err.code }, err.message);
        return Response.json(
          actionError(err.code, err.message, err.fieldErrors),
          { status },
        );
      }
      log.error({ err }, "Unhandled error in route handler");
      return Response.json(actionError("INTERNAL", "Erro interno"), { status: 500 });
    }
  };
}
```

---

## 3. Padrão completo de um Route Handler

```typescript
// src/app/api/v1/accounts/[accountId]/months/route.ts
import { z } from "zod";
import { requireAccountAccess } from "@/server/auth/session";
import { getMonths } from "@/server/services/month-service";
import { defineRoute } from "@/server/api/route-helpers";
import { registry } from "@/server/api/openapi-registry";

// 1. Registrar no OpenAPI (obrigatório para /api/v1/)
registry.registerPath({
  method: "get",
  path: "/api/v1/accounts/{accountId}/months",
  tags: ["Months"],
  request: {
    params: z.object({ accountId: z.string() }),
  },
  responses: {
    200: { description: "Lista de meses", content: { "application/json": { schema: MonthListSchema } } },
    401: { description: "Não autenticado" },
    403: { description: "Sem permissão" },
  },
});

// 2. Handler via defineRoute
export const GET = defineRoute({
  module: "api.months",
  handler: async (_input, { accountId }) => {
    await requireAccountAccess(accountId);           // auth primeiro
    return getMonths(accountId);                     // delega ao service
  },
});
```

---

## 4. OpenAPI — somente `/api/v1/`

| Rota | OpenAPI obrigatório? |
|---|---|
| `/api/v1/...` | **Sim** — clientes externos dependem da spec |
| `/api/auth/[...nextauth]` | Não — gerenciado pelo NextAuth |
| `/api/health` | Não — uso interno |
| `/api/docs`, `/api/openapi.json` | Não — são a própria spec |

### Setup do registry

**Criar** [src/server/api/openapi-registry.ts](src/server/api/openapi-registry.ts):

```typescript
// src/server/api/openapi-registry.ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";

export const registry = new OpenAPIRegistry();

export function generateOpenApiSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: { title: "MyAccountant API", version: "1.0.0" },
    servers: [{ url: "/api/v1" }],
  });
}
```

**Expor em** `src/app/api/openapi.json/route.ts`:

```typescript
import { generateOpenApiSpec } from "@/server/api/openapi-registry";

export function GET() {
  return Response.json(generateOpenApiSpec());
}
```

---

## 5. Formato de resposta

Mesmo envelope do `ActionResult` das Server Actions — consistência para clientes que consomem tanto a API REST quanto as actions:

```typescript
// Sucesso
{ ok: true, data: { ... } }

// Erro
{ ok: false, error: { code: "NOT_FOUND", message: "Mês não encontrado", fieldErrors?: {...} } }
```

O `defineRoute` serializa isso automaticamente. No handler, apenas retornar os dados do service.

---

## 6. Mapeamento `AppError` → HTTP status

| `AppError` / código | Status HTTP |
|---|---|
| `UnauthorizedError` / `UNAUTHORIZED` | 401 |
| `ForbiddenError` / `FORBIDDEN` | 403 |
| `NotFoundError` / `NOT_FOUND` | 404 |
| `ConflictError` / `CONFLICT` | 409 |
| `AppError("VALIDATION")` | 422 |
| Qualquer outro erro | 500 |

O `defineRoute` cuida do mapeamento automaticamente. Não fazer `if (err.code === "UNAUTHORIZED") return Response.json(..., { status: 401 })` manualmente.

---

## 7. Rotas que retornam arquivo (CSV, XLSX)

Para rotas de export não usar `defineRoute` — elas retornam `Response` direto com `Content-Type` adequado:

```typescript
export async function GET(req: Request, { params }: { params: Promise<{...}> }) {
  const { accountId, monthId } = await params;
  const log = logger.child({ module: "export.csv", accountId });

  try {
    await requireAccountAccess(accountId);
    const csv = await buildMonthCsv(accountId, monthId);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mes-${monthId}.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return Response.json({ error: err.code }, { status: ERROR_STATUS[err.code] ?? 500 });
    }
    log.error({ err }, "Export failed");
    return Response.json({ error: "INTERNAL" }, { status: 500 });
  }
}
```

Rotas de arquivo **não** têm registro OpenAPI (não são consumidas por clientes JSON).

---

## Anti-padrões

| ❌ Não fazer | ✅ Fazer |
|---|---|
| Lógica de negócio no handler | Delegar ao service |
| `if (err.code === "UNAUTHORIZED") status = 401` manual | `defineRoute` faz o mapeamento |
| `return Response.json({ error: "NOT_FOUND" })` sem `defineRoute` | Lançar `NotFoundError` no service |
| Route Handler sem `requireAccountAccess` | Auth sempre antes de qualquer dado |
| `registry.registerPath` em rota `/api/health` ou `/api/auth/` | OpenAPI só para `/api/v1/` |
| Formato de erro diferente do `ActionResult` | `{ ok: false, error: { code, message } }` |
| `console.log` | `logger.child({ module: "..." })` |
| `process.env.X` | `env.X` de `@/lib/env.ts` |

---

## Referência de arquivos

| Arquivo | Papel |
|---|---|
| [src/server/api/route-helpers.ts](src/server/api/route-helpers.ts) | `defineRoute` — wrapper padrão |
| [src/server/api/openapi-registry.ts](src/server/api/openapi-registry.ts) | Registry central OpenAPI |
| [src/server/api/errors.ts](src/server/api/errors.ts) | `AppError`, `NotFoundError`, `ForbiddenError`, `ConflictError`, `UnauthorizedError` |
| [src/lib/action-result.ts](src/lib/action-result.ts) | `ActionResult`, `actionSuccess`, `actionError`, `ActionErrorCode` |
| [src/server/auth/session.ts](src/server/auth/session.ts) | `requireAccountAccess` |
| [src/app/api/v1/](src/app/api/v1/) | Todos os route handlers públicos |
| [specs/14-api-and-swagger.md](specs/14-api-and-swagger.md) | Spec completa da API REST + OpenAPI |
