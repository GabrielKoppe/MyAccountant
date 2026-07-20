import { env } from "@/lib/env";
import { consumeAuthCode } from "@/server/mcp/oauth/codes";
import { verifyPkceS256 } from "@/server/mcp/oauth/pkce";
import { issueTokens, rotateRefreshToken, upsertGrant } from "@/server/mcp/oauth/store";

/**
 * Token endpoint (RFC 6749 §3.2 + PKCE, OAuth 2.1) — spec 63, Task 3.5.
 *
 * Troca um authorization code (fluxo `authorization_code`) ou rotaciona um
 * refresh token (fluxo `refresh_token`) por um novo par de tokens. Este é o
 * ponto onde um code/refresh **roubado ou reproduzido (replay)** precisa ser
 * rejeitado — as invariantes de segurança da Fase 3 (ver preamble do spec 63)
 * valem integralmente aqui:
 *
 * - `consumeAuthCode` é o PRIMEIRO gate no fluxo `authorization_code`: ele
 *   marca o code como consumido atomicamente (`updateMany` com
 *   `consumedAt: null` no `where`) e retorna `null` num replay — a checagem
 *   roda ANTES de qualquer outra validação, então mesmo um replay com PKCE e
 *   `redirect_uri`/`client_id` corretos é rejeitado.
 * - `record.clientId`/`record.redirectUri` precisam bater EXATAMENTE (nunca
 *   prefixo/substring) com o que veio na requisição, e `verifyPkceS256`
 *   confirma que quem está trocando o code é o mesmo client que gerou o
 *   `code_verifier` (comparação em tempo constante, ver `pkce.ts`).
 * - `refresh_token` é revalidado e rotacionado por `rotateRefreshToken`, que
 *   já implementa o gate de uso único (o refresh antigo é invalidado na
 *   mesma operação que emite o par novo — ver `store.ts`).
 *
 * Erros nunca vazam detalhe interno: sempre `{ error: "invalid_grant" }` ou
 * `{ error: "unsupported_grant_type" }`, HTTP 400, `Cache-Control: no-store`
 * (tokens/erros de token endpoint nunca devem ser cacheados).
 */

type Tokens = { accessToken: string; refreshToken: string };

function oauthError(error: "invalid_grant" | "unsupported_grant_type"): Response {
  return Response.json({ error }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

function tokenResponse(tokens: Tokens): Response {
  return Response.json(
    {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: env.MCP_ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: tokens.refreshToken,
      scope: "read",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Lê um campo do form-urlencoded como string; qualquer outro shape vira `""` (nunca lança). */
function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request): Promise<Response> {
  if (!env.MCP_ENABLED) {
    return new Response(null, { status: 404 });
  }

  const form = await request.formData();
  const grantType = formString(form, "grant_type");

  if (grantType === "authorization_code") {
    const code = formString(form, "code");
    const codeVerifier = formString(form, "code_verifier");
    const redirectUri = formString(form, "redirect_uri");
    const clientId = formString(form, "client_id");

    // Gate de uso único PRIMEIRO: um replay do mesmo code precisa ser
    // rejeitado atomicamente antes de qualquer outra checagem.
    const record = await consumeAuthCode(code);
    if (!record) return oauthError("invalid_grant");

    if (
      record.clientId !== clientId ||
      record.redirectUri !== redirectUri ||
      !verifyPkceS256(codeVerifier, record.codeChallenge)
    ) {
      return oauthError("invalid_grant");
    }

    // Grant já existe do consentimento (Task 3.4) — upsertGrant é idempotente.
    const grant = await upsertGrant(record.userId, record.accountId, record.clientId);
    const tokens = await issueTokens(grant.id);

    return tokenResponse(tokens);
  }

  if (grantType === "refresh_token") {
    const refreshToken = formString(form, "refresh_token");

    const tokens = await rotateRefreshToken(refreshToken);
    if (!tokens) return oauthError("invalid_grant");

    return tokenResponse(tokens);
  }

  return oauthError("unsupported_grant_type");
}
