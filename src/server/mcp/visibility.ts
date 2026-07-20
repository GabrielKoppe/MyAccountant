import { ensureMembership } from "@/server/auth/membership";

/**
 * Contexto de leitura das tools MCP. Ponto ÚNICO de enforcement de acesso.
 * Hoje (spec 44 não implementada) carrega só accountId + userId e reconfirma membership.
 * Quando a spec 44 existir, ESTE arquivo passa a resolver a visibilidade efetiva
 * (SectionVisibility, papel `accountant`) — e toda tool já a herda, sem alteração.
 */
export type ReadContext = {
  accountId: string;
  userId: string;
  // futuro (spec 44): visibleSectionIds?: string[]; aggregateOnly?: boolean; role?: AccountMemberRole;
};

export async function resolveReadContext(accountId: string, userId: string): Promise<ReadContext> {
  await ensureMembership(userId, accountId);
  return { accountId, userId };
}
