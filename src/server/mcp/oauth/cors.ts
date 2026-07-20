/**
 * CORS para os endpoints de fluxo OAuth (`/api/oauth/token`, `/api/oauth/register`)
 * — spec 63, blocker final do conector MCP.
 *
 * A troca de token roda **no browser** para clients MCP web-based (MCP
 * Inspector, Claude.ai): o fetch de `POST /api/oauth/token` é cross-origin
 * (origem do client → origem do nosso app). Sem `Access-Control-Allow-Origin`
 * no preflight `OPTIONS`, o browser bloqueia o POST antes mesmo dele sair —
 * o code nunca é trocado, 0 tokens são emitidos, e toda chamada a `/api/mcp`
 * resulta em 401.
 *
 * Os endpoints de metadata (`.well-known/...`) já resolvem isso via
 * `metadataCorsOptionsRequestHandler()` do `mcp-handler`; este helper cobre
 * os endpoints de fluxo que essa lib não trata.
 *
 * Sem `Access-Control-Allow-Credentials`: estes endpoints autenticam via
 * PKCE (fluxo `authorization_code`) e Bearer token (fluxo `refresh_token`),
 * nunca via cookies — então ecoar a origin (ou `*` na ausência de uma) sem
 * `Allow-Credentials` é seguro e correto.
 */

const DEFAULT_ALLOWED_HEADERS = "Content-Type, Authorization, MCP-Protocol-Version";

/** Monta os headers de CORS para uma resposta, ecoando a origin da requisição. */
export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "*";
  const requestedHeaders = req.headers.get("access-control-request-headers");

  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requestedHeaders ?? DEFAULT_ALLOWED_HEADERS,
    "Access-Control-Max-Age": "86400",
  };
}

/** Resposta de preflight (`OPTIONS`) padrão para os endpoints de fluxo OAuth. */
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
