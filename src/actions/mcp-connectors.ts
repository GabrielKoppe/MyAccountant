"use server";

import { revalidatePath } from "next/cache";

import { revokeConnectorSchema } from "@/lib/schemas/mcp-connectors";
import { defineAction } from "@/server/api/define-action";
import { NotFoundError } from "@/server/api/errors";
import { revokeGrant } from "@/server/mcp/oauth/store";
import { prisma } from "@/server/prisma";

/**
 * Revoga um connector MCP (`McpGrant`) da Account do usuário autenticado
 * (spec 63, Task 4.1).
 *
 * Multi-tenancy: `defineAction` já garante (via `requireAccountAccess`) que o
 * usuário é membro de `accountId`. Isso NÃO é suficiente — antes de revogar,
 * validamos que o `McpGrant` alvo pertence EXATAMENTE a essa Account. Sem essa
 * segunda checagem, um membro da Account A poderia revogar (ou confirmar a
 * existência de) o grant de outra Account só adivinhando/recebendo o
 * `grantId`. Se o grant não existir ou pertencer a outra Account, lançamos
 * `NotFoundError` (sem distinguir os dois casos, para não vazar existência)
 * e `revokeGrant` nunca é chamado.
 */
export const revokeConnectorAction = defineAction({
  schema: revokeConnectorSchema,
  handler: async (input, ctx) => {
    const grant = await prisma.mcpGrant.findUnique({
      where: { id: input.grantId },
      select: { id: true, accountId: true },
    });

    if (!grant || grant.accountId !== ctx.accountId) {
      throw new NotFoundError("Connector");
    }

    await revokeGrant(grant.id);
    revalidatePath(`/${ctx.accountId}/settings/connectors`);
  },
});
