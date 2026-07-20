import { cache } from "react";

import { prisma } from "@/server/prisma";

export type AccountConnector = {
  id: string;
  clientName: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

/**
 * Lista os connectors MCP ativos (não revogados) do usuário autenticado
 * dentro de uma Account.
 *
 * User-scoped (spec 63, Task 4.1): cada membro vê e revoga SOMENTE os
 * próprios connectors — filtrado por `accountId` E `userId`. Chamado apenas
 * depois de `requireAccountAccess(accountId)` confirmar que o usuário é
 * membro.
 */
export const getAccountConnectors = cache(
  async (accountId: string, userId: string): Promise<AccountConnector[]> => {
    const grants = await prisma.mcpGrant.findMany({
      where: { accountId, userId, revokedAt: null },
      include: { client: { select: { clientName: true } } },
      orderBy: { createdAt: "desc" },
    });

    return grants.map((grant) => ({
      id: grant.id,
      clientName: grant.client.clientName,
      createdAt: grant.createdAt,
      lastUsedAt: grant.lastUsedAt,
    }));
  },
);
