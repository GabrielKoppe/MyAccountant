"use server";

import { revalidatePath } from "next/cache";

import { revokeConnectorSchema } from "@/lib/schemas/mcp-connectors";
import { defineAction } from "@/server/api/define-action";
import { NotFoundError } from "@/server/api/errors";
import { revokeGrant } from "@/server/mcp/oauth/store";
import { prisma } from "@/server/prisma";

/**
 * Revoga um connector MCP (`McpGrant`) do PRÓPRIO usuário autenticado
 * (spec 63, Task 4.1).
 *
 * User-scoped: `defineAction` garante (via `requireAccountAccess`) que o
 * usuário é membro de `accountId` — mas isso NÃO é suficiente, pois qualquer
 * membro poderia revogar o grant de OUTRO membro só adivinhando/recebendo o
 * `grantId`. Por isso validamos que o `McpGrant` alvo pertence EXATAMENTE a
 * essa Account E a esse usuário (`grant.userId === ctx.userId`). Se o grant
 * não existir, pertencer a outra Account, ou pertencer a outro usuário da
 * mesma Account, lançamos `NotFoundError` (sem distinguir os casos, para não
 * vazar existência) e `revokeGrant` nunca é chamado. Não é necessário
 * `requireRoles` — o user-scoping já é o gate de autorização.
 */
export const revokeConnectorAction = defineAction({
  schema: revokeConnectorSchema,
  handler: async (input, ctx) => {
    const grant = await prisma.mcpGrant.findUnique({
      where: { id: input.grantId },
      select: { id: true, accountId: true, userId: true },
    });

    if (!grant || grant.accountId !== ctx.accountId || grant.userId !== ctx.userId) {
      throw new NotFoundError("Connector");
    }

    await revokeGrant(grant.id);
    revalidatePath(`/${ctx.accountId}/settings/connectors`);
  },
});
