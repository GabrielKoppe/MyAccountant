"use server";

import { approveConsentSchema } from "@/lib/schemas/mcp-consent";
import { defineUserAction } from "@/server/api/define-action";
import { AppError } from "@/server/api/errors";
import { ensureMembership } from "@/server/auth/membership";
import { getClient } from "@/server/mcp/oauth/clients";
import { createAuthCode } from "@/server/mcp/oauth/codes";
import { upsertGrant } from "@/server/mcp/oauth/store";

/**
 * Aprova o consentimento OAuth do connector MCP (spec 63, Task 3.4).
 *
 * Esta action é o ponto crítico de segurança + multi-tenancy do fluxo: só
 * depois de (1) revalidar `clientId`/`redirectUri` no server — nunca confiar
 * no que a tela de consentimento enviou — e (2) confirmar via
 * `ensureMembership` que o usuário é de fato membro da Account escolhida
 * (rejeita `accountId` de uma Account de terceiros) é que um grant é
 * upsertado e um authorization code de uso único é emitido.
 */
export const approveConsentAction = defineUserAction({
  schema: approveConsentSchema,
  handler: async (input, ctx) => {
    const client = await getClient(input.clientId);
    if (!client || !client.redirectUris.includes(input.redirectUri)) {
      throw new AppError("VALIDATION", "Client OAuth ou redirect_uri inválidos.");
    }

    // Gate de multi-tenancy: lança ForbiddenError se o usuário não for
    // membro de `accountId` — nenhum grant/code chega a ser criado.
    await ensureMembership(ctx.userId, input.accountId);

    await upsertGrant(ctx.userId, input.accountId, input.clientId);

    const code = await createAuthCode({
      clientId: input.clientId,
      userId: ctx.userId,
      accountId: input.accountId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: "read",
    });

    const redirectTo = new URL(input.redirectUri);
    redirectTo.searchParams.set("code", code);
    if (input.state) redirectTo.searchParams.set("state", input.state);

    return { redirectTo: redirectTo.toString() };
  },
});
