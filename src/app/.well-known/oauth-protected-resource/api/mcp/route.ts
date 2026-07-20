import {
  getPublicOrigin,
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";

import { env } from "@/lib/env";

/**
 * Protected Resource Metadata (RFC 9728) — path-inserted, spec 63.
 *
 * RFC 9728 exige path-insertion: para um recurso protegido em
 * `<origin>/api/mcp`, o documento de metadados precisa viver em
 * `<origin>/.well-known/oauth-protected-resource/api/mcp` e declarar
 * `"resource": "<origin>/api/mcp"`. O handler raiz
 * (`../route.ts`) só cobre o caso sem path-insertion e fica como fallback
 * inofensivo — clients MCP (ex.: MCP Inspector) buscam este aqui.
 */

export async function GET(request: Request) {
  const issuer = env.MCP_ISSUER_URL ?? getPublicOrigin(request);

  return protectedResourceHandler({ authServerUrls: [issuer], resourceUrl: `${issuer}/api/mcp` })(
    request,
  );
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
