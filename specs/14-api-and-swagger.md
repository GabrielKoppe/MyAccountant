# Spec 14 — API REST + Swagger

> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`env-validation`](../skills/env-validation/SKILL.md)

## 1. Propósito

Define como o backend expõe uma **API REST documentada via OpenAPI/Swagger**, paralela às Server Actions, **sem duplicar lógica de negócio**.

## 2. Arquitetura: service layer compartilhado

A chave é separar **lógica de negócio** (services) de **transporte** (Action / Route Handler):

```
┌──────────────────────────────────────────────────────────┐
│                       UI (forms)                          │
│                          │                                │
│                          ▼                                │
│         ┌────────────────────────────────┐               │
│         │   Server Actions (transport)   │               │
│         │   src/actions/                 │               │
│         └────────────────┬───────────────┘               │
│                          │                                │
│                          ▼                                │
│         ┌────────────────────────────────┐               │
│         │   Services (business logic)    │ ← fonte única │
│         │   src/server/services/         │               │
│         └────────────────┬───────────────┘               │
│                          ▲                                │
│         ┌────────────────┴───────────────┐               │
│         │   Route Handlers (transport)   │               │
│         │   src/app/api/v1/              │               │
│         └────────────────────────────────┘               │
│                          ▲                                │
│                          │                                │
│              External clients (mobile, integrations)      │
└──────────────────────────────────────────────────────────┘
```

> Cada operação tem **um service + um action + um route handler**. Lógica fica no service. Action e Handler são finos.

## 3. Stack

- **`@asteasolutions/zod-to-openapi`** — gera OpenAPI spec a partir dos Zod schemas
- **`swagger-ui-react`** — render do Swagger UI no Next.js

```bash
pnpm add @asteasolutions/zod-to-openapi
pnpm add swagger-ui-react
pnpm add -D @types/swagger-ui-react
```

## 4. Versionamento

API versionada via path: `/api/v1/...`. Quando precisar quebrar compat, criar `/api/v2/...` mantendo v1 funcional por tempo definido.

```
/api/v1/accounts                          GET, POST
/api/v1/accounts/{accountId}              GET, PATCH, DELETE
/api/v1/accounts/{accountId}/months       GET, POST
/api/v1/accounts/{accountId}/months/{monthId}/transactions  GET, POST
/api/v1/accounts/{accountId}/sections     GET, POST
/api/v1/accounts/{accountId}/members      GET, POST (invite)
...

/api/auth/[...nextauth]                   gerenciado pelo NextAuth
/api/docs                                 Swagger UI
/api/openapi.json                         OpenAPI spec gerada
/api/health                               healthcheck
```

## 5. Estrutura de pastas

```
src/
├── server/
│   ├── api/
│   │   ├── openapi-registry.ts       # registry central de schemas
│   │   ├── route-helpers.ts          # defineRoute() — wrapper análogo ao defineAction
│   │   └── errors.ts                 # AppError, mappers para HTTP status
│   └── services/                     # lógica (1 service por entidade)
└── app/
    └── api/
        ├── v1/
        │   ├── accounts/route.ts
        │   ├── accounts/[id]/route.ts
        │   ├── accounts/[id]/months/route.ts
        │   └── ...
        ├── docs/
        │   └── page.tsx              # Swagger UI
        ├── openapi.json/
        │   └── route.ts              # serve OpenAPI spec
        └── health/route.ts
```

## 6. OpenAPI registry

Registry central onde schemas se registram. Resultado: um único OpenAPI doc.

```ts
// src/server/api/openapi-registry.ts

import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Segurança (Bearer token)
registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "MyAccountant API",
      version: "1.0.0",
      description: "API REST para integração externa com MyAccountant",
    },
    servers: [
      { url: "http://localhost:3000/api/v1", description: "Local dev" },
      { url: "https://api.myaccountant.app/api/v1", description: "Produção" },
    ],
  });
}
```

## 7. Registrar schemas

Schemas já existem em `src/lib/schemas/`. Adicionar metadata `.openapi()` neles:

```ts
// src/lib/schemas/transaction.ts
import { z } from "zod";

// Já roda extendZodWithOpenApi em openapi-registry.ts
import "@/server/api/openapi-registry";

export const transactionSchema = z.object({
  id: z.string().cuid().openapi({ example: "clxyz123abc" }),
  accountId: z.string().cuid(),
  occurredOn: z.coerce.date().openapi({ example: "2026-01-15" }),
  amountCents: z.coerce.bigint().openapi({
    description: "Valor em centavos. Pode ser negativo.",
    example: "12345" as any,
  }),
  description: z.string().nullable(),
  // ...
}).openapi("Transaction");

export const createTransactionSchema = transactionSchema
  .omit({ id: true, accountId: true })
  .openapi("CreateTransactionInput");
```

## 8. Definir Route Handler

Helper `defineRoute()` análogo ao `defineAction()` do skill de Server Actions:

```ts
// src/server/api/route-helpers.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { registry } from "@/server/api/openapi-registry";
import { logger } from "@/server/logger";
import { AppError } from "@/server/api/errors";
import { requireApiAuth } from "@/server/auth/api-auth";

const errorCodeToStatus: Record<string, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

type RouteConfig<TParams, TBody, TResponse> = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  tags?: string[];
  params?: z.ZodType<TParams>;
  body?: z.ZodType<TBody>;
  response: z.ZodType<TResponse>;
  handler: (input: { params: TParams; body: TBody; userId: string }) => Promise<TResponse>;
};

export function defineRoute<TParams, TBody, TResponse>(
  config: RouteConfig<TParams, TBody, TResponse>,
) {
  // Registrar no OpenAPI
  registry.registerPath({
    method: config.method.toLowerCase() as any,
    path: config.path,
    summary: config.summary,
    tags: config.tags,
    security: [{ bearerAuth: [] }],
    request: {
      params: config.params,
      body: config.body
        ? { content: { "application/json": { schema: config.body } }, required: true }
        : undefined,
    },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: config.response } },
      },
      400: { description: "Validation error" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Not found" },
      500: { description: "Internal error" },
    },
  });

  // Retornar o handler do Next
  return async (req: NextRequest, routeContext: { params: Promise<TParams> }) => {
    try {
      // Auth (Bearer ou Session)
      const { userId } = await requireApiAuth(req);

      // Params
      const rawParams = await routeContext.params;
      const params = config.params
        ? config.params.parse(rawParams)
        : (rawParams as TParams);

      // Body
      let body: TBody = undefined as TBody;
      if (config.body) {
        const rawBody = await req.json().catch(() => ({}));
        body = config.body.parse(rawBody);
      }

      const result = await config.handler({ params, body, userId });
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: { code: "VALIDATION", message: "Dados inválidos", issues: error.issues } },
          { status: 400 },
        );
      }
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: errorCodeToStatus[error.code] ?? 500 },
        );
      }
      logger.error({ err: error, path: config.path }, "Route handler failed");
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Erro interno" } },
        { status: 500 },
      );
    }
  };
}
```

## 9. Exemplo de Route Handler

```ts
// src/app/api/v1/accounts/[accountId]/transactions/route.ts

import { z } from "zod";

import { defineRoute } from "@/server/api/route-helpers";
import {
  createTransactionSchema,
  transactionSchema,
} from "@/lib/schemas/transaction";
import { transactionService } from "@/server/services/transaction-service";

const ParamsSchema = z.object({ accountId: z.string().cuid() });

export const POST = defineRoute({
  method: "POST",
  path: "/accounts/{accountId}/transactions",
  summary: "Cria uma nova transação",
  tags: ["Transactions"],
  params: ParamsSchema,
  body: createTransactionSchema,
  response: transactionSchema,
  handler: async ({ params, body, userId }) => {
    return transactionService.create({
      ...body,
      accountId: params.accountId,
      createdById: userId,
    });
  },
});

const ListResponseSchema = z.object({
  data: z.array(transactionSchema),
  pagination: z.object({ nextCursor: z.string().nullable() }),
});

export const GET = defineRoute({
  method: "GET",
  path: "/accounts/{accountId}/transactions",
  summary: "Lista transações da Account",
  tags: ["Transactions"],
  params: ParamsSchema,
  response: ListResponseSchema,
  handler: async ({ params, userId }) => {
    return transactionService.list({
      accountId: params.accountId,
      userId,
    });
  },
});
```

## 10. Servir OpenAPI doc

```ts
// src/app/api/openapi.json/route.ts

import { NextResponse } from "next/server";

import { buildOpenApiDocument } from "@/server/api/openapi-registry";

// Importar todos os route files para registrar paths
import "@/app/api/v1/accounts/route";
import "@/app/api/v1/accounts/[accountId]/route";
import "@/app/api/v1/accounts/[accountId]/transactions/route";
// ... etc

export const dynamic = "force-static"; // pode cachear

export async function GET() {
  return NextResponse.json(buildOpenApiDocument());
}
```

> **Truque**: o registry só conhece um path quando o `route.ts` é importado. O import central no `openapi.json/route.ts` garante que todos sejam registrados antes do build.

## 11. Swagger UI

```tsx
// src/app/api/docs/page.tsx
"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return <SwaggerUI url="/api/openapi.json" />;
}
```

Acesso: `http://localhost:3000/api/docs`.

> Em prod, considerar **proteger a rota** (`/api/docs`) se a API for privada — middleware bloqueando acesso público.

## 12. Autenticação

Duas formas suportadas:

### A) Session cookie (browser)
Mesma sessão NextAuth. Útil se o cliente é o próprio web app.

### B) API Token (mobile, integrações externas)
Token Bearer no header `Authorization: Bearer <token>`.

**Modelo**:
```prisma
model ApiToken {
  id          String   @id @default(cuid())
  userId      String
  name        String   // ex: "Mobile app", "Zapier integration"
  tokenHash   String   @unique // hash do token, não armazena raw
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  scopes      String[] // ex: ["transactions:read", "transactions:write"]
  createdAt   DateTime @default(now())
  revokedAt   DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Geração**:
- Usuário cria token em `/settings/api-tokens`.
- Sistema gera token raw (32 bytes random base64url), salva hash (`crypto.createHash('sha256')`).
- Mostra raw token UMA VEZ na UI. Não recupera depois.

**Helper de auth**:
```ts
// src/server/auth/api-auth.ts

export async function requireApiAuth(req: NextRequest): Promise<{ userId: string }> {
  // 1. Tentar Bearer token
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const raw = authHeader.slice(7);
    const hash = sha256(raw);
    const token = await prisma.apiToken.findUnique({ where: { tokenHash: hash } });
    if (!token || token.revokedAt || (token.expiresAt && token.expiresAt < new Date())) {
      throw new UnauthorizedError("Token inválido ou expirado");
    }
    // update lastUsedAt assincronamente, sem await
    prisma.apiToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});
    return { userId: token.userId };
  }

  // 2. Fallback: session cookie
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id };
  }

  throw new UnauthorizedError();
}
```

## 13. Rate limiting

API pública precisa de rate limit. Provider: Upstash Redis (free tier 10k req/dia).

```ts
// futuro: integração com Upstash
// no MVP, deixar comentado e ativar quando expuser a API publicamente
```

## 14. Estratégia de implementação por fase

**Não implementar a API toda de uma vez.** Spec 00 já tem 8 fases — a API "espelha" cada uma:

| Fase | UI (action) | API (route) |
|---|---|---|
| 1-2 | Auth + Accounts | `POST /auth/login`, `GET /me`, `POST /accounts` |
| 3 | Settings | `GET/POST /accounts/{id}/sections`, etc. |
| 4 | Months | `GET/POST /accounts/{id}/months` |
| 5 | Tables | `GET/POST/PATCH /...` |
| 6 | Transactions | `GET/POST/PATCH/DELETE /...` |
| 7 | Import | `POST /imports` |
| 8 | Dashboards | `GET /reports/...` |

> **Regra**: ao implementar uma fase, criar o service primeiro. Depois action e route apontam para ele.

## 15. Bibliotecas alternativas (decisão tomada)

Considerei e descartei:
- **`next-rest-framework`**: mais opinativo, menos flexibilidade — **descartado**.
- **`tRPC`**: ótimo mas substituiria Server Actions (não é nosso caso) e Swagger não é nativo — **descartado**.
- **`Zodios`**: cliente HTTP + OpenAPI — bom mas adiciona dependência — **considerado para v2**.

**Decisão**: `@asteasolutions/zod-to-openapi` + Route Handlers nativos. Flexível, type-safe, sem framework extra.

## 16. Anti-patterns

❌ Lógica de negócio em Route Handler (vai pra service)
❌ Action e Route com implementações diferentes (deve ser o mesmo service)
❌ Esquecer de importar o `route.ts` no `openapi.json/route.ts` (path não aparece no doc)
❌ Body sem schema Zod no `defineRoute` (não tipado)
❌ Token raw armazenado no DB (sempre hash)
❌ API Bearer sem rate limit em prod (DoS)

## 17. Decisões em aberto

- [ ] Documentar API privada ou pública (afeta proteção do `/api/docs`)? — **MVP: privada, doc protegida por session**
- [ ] OAuth 2 / OIDC pra integrações de terceiros? — **v3**
- [ ] Webhooks (outgoing)? — **v2**
- [ ] Rate limiting concreto (Upstash)? — **adicionar quando expor publicamente**
