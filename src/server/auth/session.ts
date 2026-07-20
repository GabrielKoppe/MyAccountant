import { UnauthorizedError } from "@/server/api/errors";
import { auth } from "@/server/auth";
import { ensureMembership } from "@/server/auth/membership";
import { prisma } from "@/server/prisma";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  // SEC-09: rejeita sessões emitidas antes da última troca de senha.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordChangedAt: true },
  });
  const loginAt = session.user.loginAt;
  if (
    dbUser?.passwordChangedAt &&
    (!loginAt || dbUser.passwordChangedAt.getTime() > loginAt)
  ) {
    throw new UnauthorizedError("Sua sessão expirou. Faça login novamente.");
  }

  return session.user as { id: string; email: string; name?: string | null; loginAt?: number };
}

export async function requireAccountAccess(accountId: string) {
  const user = await requireUser();
  const member = await ensureMembership(user.id, accountId);
  return { user, member };
}
