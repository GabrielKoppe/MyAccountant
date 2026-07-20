# SKILL — Validação de Env Vars

## Quando usar

Toda variável de ambiente do projeto. **Nunca acesse `process.env.X` direto.** Sempre via `env`.

## Princípio

Validar variáveis de ambiente no **boot da aplicação** com Zod. Se faltar uma var ou estiver no formato errado, o app crasha **imediatamente** com mensagem clara — em vez de descobrir 3h depois em runtime que `process.env.RESEND_API_KEY` era undefined.

## Stack

Opção A: **`@t3-oss/env-nextjs`** (recomendado, lib pronta com separação client/server).
Opção B: **Schema Zod direto**, mais customizável.

Vamos com a Opção A pra simplicidade.

```bash
pnpm add @t3-oss/env-nextjs zod
```

## Setup

### Schema central

```ts
// src/lib/env.ts

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Variáveis que SÓ rodam no servidor.
   * Nunca enviadas pro client. Crash no boot se faltar.
   */
  server: {
    // Node
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Database
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(), // só necessário no Neon

    // NextAuth
    NEXTAUTH_URL: z.string().url(),
    NEXTAUTH_SECRET: z
      .string()
      .min(32, "NEXTAUTH_SECRET deve ter pelo menos 32 caracteres"),

    // OAuth Google
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),

    // Email (Resend)
    RESEND_API_KEY: z.string().min(1),
    EMAIL_FROM: z.string().email().or(z.string().regex(/^.+ <.+@.+>$/)), // "Nome <email@x.com>" ou só email

    // Logging
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .optional(),

    // Rate limiting (futuro)
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  },

  /**
   * Variáveis acessíveis no client.
   * PRECISAM começar com `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    // NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  },

  /**
   * Mapeamento explícito (Next.js não passa vars pro client por default).
   */
  runtimeEnv: {
    // server
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    LOG_LEVEL: process.env.LOG_LEVEL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    // client
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  /**
   * Pula validação em alguns contextos (ex: docker build sem env).
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Trata strings vazias como undefined (evita aceitar `FOO=` como válido).
   */
  emptyStringAsUndefined: true,
});
```

### Uso no código

```ts
// ❌ Errado
const url = process.env.DATABASE_URL;

// ✅ Certo
import { env } from "@/lib/env";
const url = env.DATABASE_URL; // tipado, validado, garantido não-undefined
```

### Import em código server-only vs client

- Em código **server-only** (services, actions, route handlers): pode usar tudo (`env.DATABASE_URL`, `env.NEXT_PUBLIC_APP_URL`).
- Em código **client** (componentes com `"use client"`): só `env.NEXT_PUBLIC_*`. Se tentar acessar uma server var, o build quebra.

## .env.example atualizado

```bash
# ===== Database =====
DATABASE_URL="postgresql://myaccountant:dev_password@postgres:5432/myaccountant?schema=public"
DIRECT_URL="postgresql://myaccountant:dev_password@postgres:5432/myaccountant?schema=public"

# ===== NextAuth =====
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32-min-32-chars"

# ===== OAuth Google =====
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ===== Email (Resend) =====
RESEND_API_KEY=""
EMAIL_FROM="MyAccountant <noreply@example.com>"

# ===== Logging =====
LOG_LEVEL="debug"

# ===== Client-side =====
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ===== Build (apenas Docker build) =====
# SKIP_ENV_VALIDATION="1"
```

## Setup no docker build

Durante `docker build`, env vars não estão definidas (são runtime). Solução:

```dockerfile
# Dockerfile (stage builder)
ENV SKIP_ENV_VALIDATION=1
RUN pnpm build
```

O app valida no boot real (runtime), não no build.

## Padrões

### Múltiplos ambientes
```ts
// .env.development → usado por `next dev`
// .env.production  → usado por `next build` / `next start`
// .env.test        → usado por Vitest
// .env             → fallback (em todos)
// .env.local       → override pessoal (NÃO commitar)
```

Order de precedência (Next.js): `.env.{env}.local` > `.env.local` > `.env.{env}` > `.env`.

### Vars boolean
```ts
ENABLE_FEATURE_X: z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .default("false"),
```

### Vars numéricas
```ts
SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(30),
```

### URL com path
```ts
APP_URL: z.string().url().regex(/^https?:\/\/.*[^/]$/, "URL não pode terminar com /"),
```

## Testes

```ts
// tests/env.test.ts
import { describe, it, expect, vi } from "vitest";

describe("env validation", () => {
  it("crashes if DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(import("@/lib/env")).rejects.toThrow();
  });

  it("crashes if NEXTAUTH_SECRET is too short", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "short");
    await expect(import("@/lib/env")).rejects.toThrow();
  });
});
```

## Anti-patterns

❌ `process.env.X` direto em qualquer lugar fora de `env.ts`
❌ `process.env.X ?? "fallback"` (esconde bug — preferir crash explícito)
❌ Var commitada em `.env` versionado (NÃO COMMITAR `.env`)
❌ Var sem default e sem `.optional()` quando deveria ser opcional
❌ Validar var só em runtime (queremos crash no boot)
❌ Acessar `env.SERVER_VAR` no **top-level** de um módulo server-only importado por testes — sob jsdom (ambiente padrão do Vitest aqui) o guard client/server do `@t3-oss/env-nextjs` dispara "Attempted to access a server-side environment variable on the client" e o teste quebra no import.

## Gotcha: env em módulos server-only sob teste jsdom

Os testes rodam em `environment: "jsdom"` (window definido → o t3-env trata como client → acessar var server-only **lança**). Módulos como `logger`/`auth-service` passam porque acessam `env` **lazy** (dentro de funções). Se um módulo novo precisar de `env` para montar um singleton (ex.: cliente Redis do rate limit), **não** acesse no top-level:

```ts
// ❌ Quebra no import sob jsdom
const redis = env.UPSTASH_REDIS_REST_URL ? new Redis({ url: env.UPSTASH_REDIS_REST_URL }) : null;

// ✅ Lazy — só toca env quando chamado (runtime real: server/edge)
let _redis: Redis | null | undefined;
function getRedis() {
  if (_redis === undefined) _redis = env.UPSTASH_REDIS_REST_URL ? new Redis({ ... }) : null;
  return _redis;
}
```

Alternativa pontual: `// @vitest-environment node` no topo do teste (mas isso reintroduz a validação completa de env no import — o padrão lazy é preferível).

## Checklist

- [ ] Nenhum `process.env.X` no código (busca: `grep -r "process.env" src/`).
- [ ] Toda nova var passa por `src/lib/env.ts`.
- [ ] `.env.example` atualizado quando schema muda.
- [ ] Vars sensíveis configuradas nos secrets do CI / Vercel / VPS.
