import { prisma } from "@/server/prisma";

export type AccountConnector = {
  id: string;
  clientName: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

/**
 * Lista os connectors MCP ativos (não revogados) de uma Account.
 *
 * Multi-tenancy (spec 63, Task 4.1): sempre filtrado por `accountId` — nunca
 * expor grants de outra Account. Chamado apenas depois de
 * `requireAccountAccess(accountId)` confirmar que o usuário é membro.
 */
export async function getAccountConnectors(accountId: string): Promise<AccountConnector[]> {
  const grants = await prisma.mcpGrant.findMany({
    where: { accountId, revokedAt: null },
    include: { client: { select: { clientName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return grants.map((grant) => ({
    id: grant.id,
    clientName: grant.client.clientName,
    createdAt: grant.createdAt,
    lastUsedAt: grant.lastUsedAt,
  }));
}
