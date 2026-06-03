# SKILL — Logging Estruturado

## Quando usar

Toda vez que precisar emitir um log no servidor. **Sem `console.log`**, sempre o logger. Em client é OK usar `console` para debug local, mas nunca em commit final.

## Stack

- **[Pino](https://github.com/pinojs/pino)** — logger estruturado, rápido, JSON-first.
- **`pino-pretty`** — formatação legível em dev.

```bash
pnpm add pino
pnpm add -D pino-pretty
```

## Setup

### Logger singleton

```ts
// src/server/logger.ts

import pino from "pino";

import { env } from "@/lib/env";

const isDev = env.NODE_ENV !== "production";

export const logger = pino({
  level: env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  }),
  // Em prod, JSON estruturado direto pro stdout — agregadores (Logflare, Axiom) leem
  base: {
    env: env.NODE_ENV,
    service: "myaccountant",
  },
  redact: {
    paths: [
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.secret",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
});
```

### Env vars

```bash
# .env
LOG_LEVEL=info   # trace, debug, info, warn, error, fatal
NODE_ENV=development
```

## Padrões de uso

### Levels

| Level | Quando usar |
|---|---|
| `trace` | Detalhes muito verbosos (loops, valores intermediários). Off em prod. |
| `debug` | Info útil pra investigar. On em dev, off em prod por padrão. |
| `info` | Eventos esperados (login realizado, transação criada). |
| `warn` | Algo estranho mas que não quebrou (rate limit hit, retry funcionou). |
| `error` | Operação falhou, mas app continua. |
| `fatal` | App não consegue continuar (DB down, env var faltando no boot). |

### Logs estruturados (não string concat)

```ts
// ❌ Errado — string concat perde structure
logger.info(`Usuário ${userId} criou transação ${transactionId}`);

// ✅ Certo — campos estruturados, query-able em prod
logger.info({ userId, transactionId }, "Transaction created");
```

### Logando erros

```ts
try {
  // ...
} catch (error) {
  logger.error({ err: error, accountId, userId }, "Failed to create transaction");
  throw error;
}
```

> Pino auto-serializa `err` corretamente (stack trace, name, message).

### Correlation ID por request

Em middleware ou Route Handler, crie um logger filho com request ID:

```ts
// src/middleware.ts
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

export function middleware(req) {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return response;
}
```

```ts
// Em Route Handler
import { logger } from "@/server/logger";

export async function GET(req) {
  const requestId = req.headers.get("x-request-id");
  const log = logger.child({ requestId, path: "/api/v1/transactions" });

  log.info("Request received");
  // ...
  log.info({ count }, "Returning transactions");
}
```

## O que logar

### Sempre logar
- **Auth events**: login, logout, signup, password reset, failed login.
- **Permission denials**: tentativa de acesso a recurso de outra Account (suspicious).
- **Mutations importantes**: account criada, member removido, invite enviado.
- **Erros**: todo erro pego em try/catch, mesmo que já tratado.
- **Operações lentas**: query > 1s, action > 3s (warn).
- **Boot**: app iniciado, conexão DB ok, env vars válidas.

### Logar com cuidado
- **Reads frequentes** (listagem de transações): `debug`, não `info` (ruído).
- **Webhooks recebidos**: sim, mas sem payload completo (pode ter dado sensível).

### Nunca logar
- ❌ Senhas, password hashes, tokens, secrets, cookies completos
- ❌ Dados pessoais sensíveis sem necessidade (CPF, email completo)
- ❌ Payload completo de transação (pode incluir notas privadas)

> Pino tem `redact` config para mascarar campos automaticamente. Use sempre.

## Helpers úteis

### Logger por módulo

```ts
// src/server/services/transaction-service.ts
import { logger } from "@/server/logger";

const log = logger.child({ module: "transaction-service" });

export async function createTransaction(input) {
  log.debug({ accountId: input.accountId }, "Creating transaction");
  // ...
  log.info({ transactionId: tx.id, accountId: input.accountId }, "Transaction created");
}
```

Filtra logs facilmente por módulo em prod (`module:transaction-service`).

### Timing

```ts
const start = performance.now();
const result = await heavyOperation();
const ms = Math.round(performance.now() - start);

log.info({ ms, operation: "import" }, "Operation completed");

if (ms > 1000) {
  log.warn({ ms, operation: "import" }, "Slow operation");
}
```

## Em produção

### Onde os logs vão
- Stdout em JSON → captura pelo container runtime.
- Vercel: logs aparecem no dashboard automaticamente.
- VPS com Docker: configurar driver de log (`json-file`, `journald`) ou enviar para serviço externo.

### Serviços recomendados (escolher quando precisar)
- **Better Stack** (free tier generoso)
- **Axiom** (free tier de 500GB/mo)
- **Logflare** (boa integração com Vercel)
- **Sentry** (focado em errors + APM, complementar)

### Não usar em prod
- `pino-pretty` (pesado, sem benefício)
- File logs (rotação, espaço em disco — deixa pro orchestrator)

## Client-side logging

Para Client Components que precisam logar erros (ex: error boundary):

```ts
// src/lib/client-logger.ts
"use client";

export const clientLogger = {
  info: (message: string, data?: object) => {
    if (process.env.NODE_ENV === "development") {
      console.info(`[client] ${message}`, data);
    }
    // Em prod, considerar enviar via beacon API ou Sentry
  },
  error: (message: string, error: unknown, data?: object) => {
    console.error(`[client] ${message}`, error, data);
    // TODO: enviar pra Sentry em prod
  },
};
```

## Anti-patterns

❌ `console.log` em código de produção
❌ String concatenation no log message (perde structure)
❌ Logar exceções sem stack trace
❌ Logar tudo em `info` (vira ruído, custa $)
❌ Não logar erros que foram "tratados" (você perde visibility)
❌ Logar dados sensíveis (sempre revisar `redact` config)
❌ Logger novo por chamada (`new Logger()`) — use o singleton

## Checklist em PR

- [ ] Sem `console.log` no código.
- [ ] Erros em try/catch são logados com contexto.
- [ ] Mutações de auth/permissão são logadas como `info`.
- [ ] Sem dado sensível no log (revisar manualmente em campos novos).
- [ ] Operações lentas têm timing + warn se passar do threshold.
