import { createMcpHandler, withMcpAuth } from "mcp-handler";

import { env } from "@/lib/env";
import { logger } from "@/server/logger";
import { verifyMcpBearer } from "@/server/mcp/auth";
import { checkMcpRateLimit } from "@/server/mcp/rate-limit";
import { serializeForMcp } from "@/server/mcp/serialize";
import { mcpTools } from "@/server/mcp/tools";
import { resolveReadContext } from "@/server/mcp/visibility";
import { prisma } from "@/server/prisma";

/**
 * Endpoint MCP remoto (spec 63, Task 2.2) — conector fica em `/api/mcp`
 * (basePath `/api` + rota `[transport]`, ver §2.1 do spike).
 *
 * Segurança: este arquivo é a fronteira entre o modelo e os dados. Duas
 * garantias não-negociáveis:
 *  1. Gate por feature flag: com `MCP_ENABLED=false` a rota devolve 404 —
 *     o conector não existe por padrão.
 *  2. `accountId`/`userId` SEMPRE vêm de `extra.authInfo.extra` (resolvido a
 *     partir do access token pelo `verifyMcpBearer`), NUNCA do input do
 *     modelo — nenhum `shape` de tool expõe `accountId` (ver tools.ts).
 */

// Gate da Task 1.3b (review): estas duas tools NÃO são registradas ainda.
// - get_sankey_data: shape aceita `sections`/`sectionTotals` pré-computados
//   pelo modelo (aggregates fabricáveis pelo client, não vindos de query real).
// - get_weekly_spending: `monthStartDay` deveria vir de account settings,
//   não ser fornecido pelo modelo.
const DEFERRED_TOOLS = new Set(["get_sankey_data", "get_weekly_spending"]);

function buildHandler() {
  const base = createMcpHandler(
    (server) => {
      for (const tool of Object.values(mcpTools).filter((t) => !DEFERRED_TOOLS.has(t.name))) {
        server.registerTool(
          tool.name,
          { description: tool.description, inputSchema: tool.shape },
          async (args, extra) => {
            const { userId, accountId, grantId } = extra.authInfo!.extra as {
              userId: string;
              accountId: string;
              grantId: string;
            };
            const start = Date.now();
            const log = logger.child({
              module: "mcp.tool",
              accountId,
              userId,
              grantId,
              tool: tool.name,
            });
            try {
              checkMcpRateLimit(grantId);
              const ctx = await resolveReadContext(accountId, userId);
              const data = await tool.run(ctx, args);
              log.info({ durationMs: Date.now() - start, ok: true }, "mcp tool call");
              // Fire-and-forget: não bloqueia a resposta da tool por causa do touch de `lastUsedAt`.
              void prisma.mcpGrant
                .update({ where: { id: grantId }, data: { lastUsedAt: new Date() } })
                .catch(() => {});
              return { content: [{ type: "text" as const, text: serializeForMcp(data) }] };
            } catch (err) {
              log.warn({ durationMs: Date.now() - start, ok: false }, "mcp tool call failed");
              throw err;
            }
          },
        );
      }
    },
    { serverInfo: { name: "MyAccountant", version: "1.0.0" } },
    { basePath: "/api", disableSse: true, maxDuration: 60 },
  );

  return withMcpAuth(base, verifyMcpBearer, { required: true, requiredScopes: ["read"] });
}

async function disabledHandler(): Promise<Response> {
  return new Response(null, { status: 404 });
}

// Só constrói o McpServer (registra tools, etc.) quando a flag está ligada —
// nada é "wired" quando o conector está desligado.
const handler = env.MCP_ENABLED ? buildHandler() : disabledHandler;

export { handler as GET, handler as POST };
