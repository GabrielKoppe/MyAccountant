# Spike MCP/OAuth — Notas de API (Task 0.1 do spec 63)

> Data: 2026-07-19 · Libs fixadas: `@modelcontextprotocol/sdk@1.29.0`, `mcp-handler@1.1.0`
> Objetivo: fixar as assinaturas reais das libs para as Fases 2–3 do plano do spec 63 não dependerem de suposição.

---

## 1. Resumo executivo (o que muda no plano)

- **Lado resource (endpoint MCP + verificação Bearer + metadata de recurso) = `mcp-handler`, Next-native. RESOLVIDO.** Fases 1–2 seguem como planejado.
- **Lado Authorization Server (authorize/token/register/revoke + metadata do AS) do SDK é Express 5** (`OAuthServerProvider.authorize(client, params, res: express.Response)`; `mcpAuthRouter(): express.RequestHandler`, "MUST be installed at the application root"). **NÃO** encaixa em Route Handler do Next App Router (Web `Request`/`Response`).
- **Consequência**: a Fase 3 do plano ("montar o AS via roteador do SDK") está **inviável como escrita**. Requer decisão de arquitetura antes de implementar (ver §5). O resto do plano (Fases 0–2, 4) não é afetado.

---

## 2. `mcp-handler@1.1.0` — API Next-native (lado resource)

Exports relevantes (de `dist/index.d.mts`):

```ts
// Cria o handler HTTP do endpoint MCP. NOME REAL: createMcpRouteHandler (não createMcpHandler).
declare function createMcpRouteHandler(
  initializeServer: (server: McpServer) => void | Promise<void>,
  serverOptions?: ServerOptions & { serverInfo?: { name: string; version: string } },
  config?: {
    basePath?: string;         // deriva os endpoints; ver §2.1
    redisUrl?: string;         // default process.env.REDIS_URL || KV_URL (necessário p/ SSE; ver §2.2)
    disableSse?: boolean;      // recomendado true (SSE deprecado no MCP)
    maxDuration?: number;      // seg, default 60
    verboseLogs?: boolean;
    onEvent?: (e: McpEvent) => void; // hook de analytics/log
    sessionIdGenerator?: undefined;  // stateless streamable HTTP
  },
): (request: Request) => Promise<Response>;

// Envolve o handler com verificação Bearer. verifyToken devolve AuthInfo (ou undefined = 401).
declare function withMcpAuth(
  handler: (req: Request) => Response | Promise<Response>,
  verifyToken: (req: Request, bearerToken?: string) => AuthInfo | undefined | Promise<AuthInfo | undefined>,
  opts?: { required?: boolean; resourceMetadataPath?: string; requiredScopes?: string[]; resourceUrl?: string },
): (req: Request) => Promise<Response>;

// Metadata de Protected Resource (RFC 9728) — Next-native. Usar p/ /.well-known/oauth-protected-resource.
declare function protectedResourceHandler(opts: { authServerUrls: string[]; resourceUrl?: string }): (req: Request) => Response;
declare function metadataCorsOptionsRequestHandler(): () => Response; // p/ OPTIONS (clients em browser)
declare function getPublicOrigin(req: Request): string;
```

`Request.auth?: AuthInfo` é aumentado globalmente — depois do `withMcpAuth`, o handler e as tools leem o auth via o `extra` do callback (ver §3).

### 2.1 Routing e `basePath`

Os endpoints são derivados de `basePath` + `"mcp"`/`"sse"`. Ex.: `basePath: "/"` → streamable em `/mcp`; o `[transport]` fica em `app/[transport]/route.ts`.

**Decisão de path (revisa §7 do spec):** para a URL do connector ficar `https://host/api/mcp`, usar a rota **`src/app/api/[transport]/route.ts`** com `config.basePath = "/api"` (→ streamable em `/api/mcp`). A rota `src/app/api/mcp/[transport]/route.ts` daria `/api/mcp/mcp` (feio). **Recomendado: `src/app/api/[transport]/route.ts`.**

### 2.2 Redis / estado

`redisUrl` é usado para sessões (principalmente SSE). Com `disableSse: true` + streamable HTTP stateless, verificar no protótipo se Redis é dispensável. Se necessário, a topologia de prod já tem **Upstash** (usado p/ rate-limit) — reaproveitar. Registrar como env opcional `MCP_REDIS_URL`.

---

## 3. `@modelcontextprotocol/sdk@1.29.0` — registro de tool

`McpServer.registerTool` (preferir sobre o `tool()` deprecado):

```ts
server.registerTool(
  name: string,
  config: { description?: string; inputSchema?: ZodRawShape; /* title, outputSchema, annotations... */ },
  cb: (args, extra: RequestHandlerExtra) => CallToolResult | Promise<CallToolResult>,
): RegisteredTool;
```

- **`inputSchema` é um `ZodRawShape`** (o objeto de shape, ex.: `{ monthId: z.string() }`) — **não** um `z.object(...)`. Ajuste no `McpTool`: guardar o shape (`z.ZodRawShape`) ou expor `.shape`.
- **`extra.authInfo`** carrega o `AuthInfo` retornado pelo `verifyToken`. Ler `extra.authInfo.extra` para `{ userId, accountId, grantId }`.
- **Retorno**: `CallToolResult` (ex.: `{ content: [{ type: "text", text: JSON.stringify(data) }] }`) — a tool precisa **serializar** o resultado da query (atenção a `BigInt`/`Date`; usar um serializer, não `JSON.stringify` cru em BigInt).

`AuthInfo` (de `server/auth/types.d.ts`):

```ts
interface AuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number;        // segundos desde epoch
  resource?: URL;
  extra?: Record<string, unknown>; // ← aqui vão userId, accountId, grantId
}
```

### 3.1 Integração do lado resource (settled)

```ts
// src/app/api/[transport]/route.ts  (config.basePath = "/api")
import { createMcpRouteHandler, withMcpAuth } from "mcp-handler";
import { mcpTools } from "@/server/mcp/tools";
import { resolveReadContext } from "@/server/mcp/visibility";
import { verifyMcpBearer } from "@/server/mcp/auth"; // devolve AuthInfo | undefined

const base = createMcpRouteHandler(
  (server) => {
    for (const tool of Object.values(mcpTools)) {
      server.registerTool(tool.name, { description: tool.description, inputSchema: tool.shape }, async (args, extra) => {
        const { userId, accountId, grantId } = extra.authInfo!.extra as { userId: string; accountId: string; grantId: string };
        const ctx = await resolveReadContext(accountId, userId); // ensureMembership + (futuro) visibilidade spec 44
        const data = await tool.run(ctx, args);
        return { content: [{ type: "text", text: serializeForMcp(data) }] };
      });
    }
  },
  { serverInfo: { name: "MyAccountant", version: "1.0.0" } },
  { basePath: "/api", disableSse: true, maxDuration: 60 },
);

const handler = withMcpAuth(base, verifyMcpBearer, { required: true, requiredScopes: ["read"] });
export { handler as GET, handler as POST };
```

`verifyMcpBearer(req, token)` = a versão "verifica token → AuthInfo" do `resolveMcpGrant` (Task 2.2): busca o grant por hash do access token; devolve `{ token, clientId, scopes: ["read"], extra: { userId, accountId, grantId } }` ou `undefined`.

> Nota: com `withMcpAuth` fazendo o gate Bearer, o rate-limit (Task 4.2) e o log (Task 4.3) entram **dentro** do `cb` da tool (ou no `onEvent`), pois é lá que temos `authInfo`.

---

## 4. Authorization Server do SDK — por que NÃO serve ao Next

```ts
// server/auth/provider.d.ts
import { Response } from 'express';                       // ← Express
authorize(client, params, res: Response): Promise<void>;  // escreve numa resposta Express
// server/auth/router.d.ts
import express, { RequestHandler } from 'express';
export function mcpAuthRouter(options): RequestHandler;    // "MUST be installed at the application root: app.use(mcpAuthRouter(...))"
```

`express: ^5.2.1` está nas `dependencies` do SDK. Todos os handlers (`handlers/authorize|token|register|revoke|metadata`) são Express `RequestHandler`. Não há caminho nativo Web `Request/Response` para o AS no SDK 1.29.

---

## 5. Bifurcação de arquitetura do AS (decisão pendente — §3 do plano)

O que o AS precisa entregar para o fluxo do connector: **DCR** (`/register`), **`/authorize`** (com login NextAuth + consentimento + seleção de Account + aviso LGPD), **`/token`** (troca de code+PKCE e refresh), **AS metadata** (`/.well-known/oauth-authorization-server`). O lado resource (verify + protected-resource metadata) já é coberto pelo mcp-handler.

- **Path A — AS nativo em Route Handlers (Prisma-backed).** Implementar os 3–4 endpoints como Route Handlers do Next, sobre o storage da Task 2.1. Superfície pequena e controlada; usa `withMcpAuth`/`protectedResourceHandler` do mcp-handler no lado resource. Contra: mais código próprio de OAuth (atrita com o "não hand-roll" do DD-03a — mas o spike prova que a lib **não** oferece AS nativo p/ Next).
- **Path B — Express shim dentro do Next.** Montar `mcpAuthRouter` via adaptador Web↔Express num catch-all. Reusa o AS do SDK, mas Express 5 como runtime no App Router é frágil (runtime/edge/streaming) — não recomendado.
- **Path C — Trocar por `better-auth` + plugin MCP (AS Next-native com DCR/metadata/consent).** Menos código de OAuth, mas 2º framework de auth ao lado do NextAuth (era a opção recusada antes; o spike enfraquece o motivo da recusa, já que o SDK não resolve o AS).

**Recomendação: Path A.** A superfície do AS para um único fluxo de connector é modesta e nós já temos o storage (Task 2.1) e o login (NextAuth) prontos; ganhamos controle total e evitamos um 2º framework de auth. Reavaliar C se DCR/consent virarem custo alto.

---

## 6. Correções a aplicar no plano do spec 63 (pós-spike)

1. **Fase 2 / §7**: rota `src/app/api/[transport]/route.ts` (basePath `/api`), não `src/app/api/mcp/[transport]/route.ts`.
2. **Task 1.3**: `McpTool` guarda `shape: z.ZodRawShape` (para `registerTool.inputSchema`), além do `schema` `z.object` (para validação/testes). `run(ctx, args)` recebe `args` já validado pelo SDK.
3. **Tool result**: adicionar um `serializeForMcp(data)` (trata `BigInt`→string de centavos, `Date`→ISO) — as queries retornam `BigInt` (money-handling).
4. **`resolveMcpGrant` → `verifyMcpBearer`**: expor a forma que devolve `AuthInfo | undefined` (contrato do `withMcpAuth`), além da que lança.
5. **Fase 3**: substituir "roteador de AS do SDK" por **Path A** (AS nativo). Precisa de decisão do dono antes de dispatch.
6. **Rate-limit/log (Fase 4)**: entram dentro do `cb` da tool (onde há `authInfo`), não num middleware separado.
