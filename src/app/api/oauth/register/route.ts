import { env } from "@/lib/env";
import { registerClient } from "@/server/mcp/oauth/clients";

/**
 * Dynamic Client Registration (RFC 7591) — spec 63, Task 3.3.
 *
 * Endpoint público: conectores MCP se auto-registram aqui para obter um
 * `client_id` antes do fluxo de authorize. Client é sempre **público**
 * (sem `client_secret`) — autenticação real fica no fluxo authorize/token
 * (PKCE + login do usuário), o `client_id` só identifica o software cliente.
 *
 * Gate por `MCP_ENABLED`: mesmo comportamento do endpoint `/api/mcp`
 * (ver `src/app/api/[transport]/route.ts`) — com a flag desligada, o
 * conector não existe.
 *
 * Rate-limit deste endpoint aberto fica para a Task 4.2.
 */

const invalidClientMetadata = (description: string) =>
  Response.json({ error: "invalid_client_metadata", error_description: description }, { status: 400 });

function isAllowedRedirectUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }

  if (parsed.protocol === "https:") return true;

  return parsed.protocol === "http:" && parsed.hostname === "localhost";
}

export async function POST(request: Request): Promise<Response> {
  if (!env.MCP_ENABLED) {
    return new Response(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidClientMetadata("Corpo da requisição precisa ser um JSON válido.");
  }

  if (typeof body !== "object" || body === null) {
    return invalidClientMetadata("Corpo da requisição precisa ser um objeto JSON.");
  }

  const { client_name, redirect_uris } = body as {
    client_name?: unknown;
    redirect_uris?: unknown;
  };

  if (
    !Array.isArray(redirect_uris) ||
    redirect_uris.length === 0 ||
    !redirect_uris.every((uri): uri is string => typeof uri === "string")
  ) {
    return invalidClientMetadata("redirect_uris precisa ser um array não vazio de strings.");
  }

  if (!redirect_uris.every(isAllowedRedirectUri)) {
    return invalidClientMetadata("redirect_uris precisa usar https:// (ou http://localhost em dev).");
  }

  const clientName = typeof client_name === "string" && client_name.length > 0 ? client_name : "MCP Client";

  const client = await registerClient({ clientName, redirectUris: redirect_uris });

  return Response.json(
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201 },
  );
}
