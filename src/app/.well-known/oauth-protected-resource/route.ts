import { getPublicOrigin, metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";

import { env } from "@/lib/env";

/**
 * Protected Resource Metadata (RFC 9728) — spec 63, Task 3.2.
 *
 * Aponta o conector MCP para o Authorization Server nativo. Estático e
 * independente de `MCP_ENABLED` (ver oauth-authorization-server/route.ts).
 */

export async function GET(request: Request) {
  const issuer = env.MCP_ISSUER_URL ?? getPublicOrigin(request);

  return protectedResourceHandler({ authServerUrls: [issuer] })(request);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
