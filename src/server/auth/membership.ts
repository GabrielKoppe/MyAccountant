import { ForbiddenError } from "@/server/api/errors";
import { prisma } from "@/server/prisma";

/**
 * Verifica se `userId` é membro de `accountId`, sem depender de sessão NextAuth.
 *
 * Usado tanto pelo fluxo autenticado via cookie (`requireAccountAccess`, que resolve
 * o userId a partir da sessão) quanto pelo contexto MCP Bearer (sem sessão), que já
 * possui o userId resolvido a partir do token.
 */
export async function ensureMembership(userId: string, accountId: string) {
  const member = await prisma.accountMember.findUnique({
    where: { accountId_userId: { accountId, userId } },
  });

  if (!member) {
    throw new ForbiddenError("Usuário não é membro desta conta.");
  }

  return member;
}
