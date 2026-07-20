import { getPublicOrigin } from "mcp-handler";

import { env } from "@/lib/env";
import { auth } from "@/server/auth";
import { getClient } from "@/server/mcp/oauth/clients";

/**
 * Authorization endpoint (RFC 6749 §3.1 + PKCE, OAuth 2.1) — spec 63, Task 3.4.
 *
 * Ponto de entrada do fluxo: o conector MCP redireciona o usuário para cá
 * com os parâmetros do authorize. Depois de validar `client_id` e
 * `redirect_uri` (as duas checagens que NUNCA podem terminar em redirect —
 * ver nota de segurança abaixo), qualquer outro parâmetro inválido volta ao
 * client via redirect com `error=invalid_request` (fluxo OAuth padrão). Sem
 * sessão, o usuário é mandado para `/login` preservando esta URL como
 * `callbackUrl`; com sessão, segue para a tela de consentimento
 * (`/oauth/consent`) com os parâmetros já validados.
 *
 * Segurança (anti open-redirect): `client_id` ausente/desconhecido ou
 * `redirect_uri` que não bate EXATAMENTE (igualdade estrita, nunca
 * prefixo/substring) com uma URI registrada do client nunca geram um
 * redirect — só uma página de erro simples em texto puro. Se este endpoint
 * redirecionasse com base num `redirect_uri` não validado, um client
 * malicioso poderia usá-lo como um redirecionador aberto.
 */

function errorPage(message: string): Response {
  return new Response(message, {
    status: 400,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request): Promise<Response> {
  if (!env.MCP_ENABLED) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(request.url);
  const params = url.searchParams;

  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const responseType = params.get("response_type");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");
  const scopeParam = params.get("scope");
  const state = params.get("state");

  const client = clientId ? await getClient(clientId) : null;
  if (!clientId || !client) {
    return errorPage("client_id ausente ou desconhecido.");
  }

  // Igualdade estrita — nunca prefixo/substring (invariante de segurança da Fase 3).
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return errorPage("redirect_uri ausente ou não registrado para este client.");
  }

  const origin = getPublicOrigin(request);

  const redirectToClientWithError = (error: string): Response => {
    const back = new URL(redirectUri);
    back.searchParams.set("error", error);
    if (state) back.searchParams.set("state", state);
    return Response.redirect(back.toString(), 302);
  };

  if (responseType !== "code") {
    return redirectToClientWithError("invalid_request");
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return redirectToClientWithError("invalid_request");
  }

  const scopes = scopeParam ? scopeParam.split(" ").filter(Boolean) : ["read"];
  if (scopes.length === 0 || !scopes.every((s) => s === "read")) {
    return redirectToClientWithError("invalid_request");
  }
  const scope = "read";

  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", url.pathname + url.search);
    return Response.redirect(loginUrl.toString(), 302);
  }

  const consentUrl = new URL("/oauth/consent", origin);
  consentUrl.searchParams.set("client_id", clientId);
  consentUrl.searchParams.set("redirect_uri", redirectUri);
  consentUrl.searchParams.set("response_type", "code");
  consentUrl.searchParams.set("code_challenge", codeChallenge);
  consentUrl.searchParams.set("code_challenge_method", "S256");
  consentUrl.searchParams.set("scope", scope);
  if (state) consentUrl.searchParams.set("state", state);

  return Response.redirect(consentUrl.toString(), 302);
}
