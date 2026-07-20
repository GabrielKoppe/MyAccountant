import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

import { findGrantByAccessToken } from "@/server/mcp/oauth/store";

/**
 * Verifica o Bearer token de uma requisição MCP. Contrato de `verifyToken` do
 * `withMcpAuth` (mcp-handler): NUNCA lança — token ausente ou inválido devolve
 * `undefined`, que `withMcpAuth` traduz em 401.
 *
 * `userId`/`accountId`/`grantId` vão em `extra` e são a ÚNICA fonte de
 * identidade que as tools devem usar (nunca aceitar esses campos vindos do
 * input do modelo — ver `src/app/api/[transport]/route.ts`).
 */
export async function verifyMcpBearer(
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const token = bearerToken ?? extractBearerToken(req);
  if (!token) return undefined;

  const grant = await findGrantByAccessToken(token);
  if (!grant) return undefined;

  return {
    token,
    clientId: grant.clientId,
    scopes: ["read"],
    extra: {
      userId: grant.userId,
      accountId: grant.accountId,
      grantId: grant.id,
    },
  };
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
}
