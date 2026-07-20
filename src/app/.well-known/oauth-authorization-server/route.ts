import { getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";

import { env } from "@/lib/env";

/**
 * Authorization Server Metadata (RFC 8414) — spec 63, Task 3.2.
 *
 * Permite que o conector MCP descubra automaticamente os endpoints do
 * Authorization Server nativo (Path A do spike, ver §5 das notas). Este
 * documento é estático e não depende de `MCP_ENABLED`: o descobrimento
 * precisa funcionar mesmo antes do connector estar habilitado.
 */

export async function GET(request: Request) {
  const issuer = env.MCP_ISSUER_URL ?? getPublicOrigin(request);

  return Response.json({
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["read"],
    token_endpoint_auth_methods_supported: ["none"],
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
