import { ForbiddenError, UnauthorizedError } from "@/server/api/errors";
import { auth } from "@/server/auth";
import { prisma } from "@/server/prisma";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session.user as { id: string; email: string; name?: string | null };
}

export async function requireAccountAccess(accountId: string) {
  const user = await requireUser();

  const member = await prisma.accountMember.findUnique({
    where: {
      accountId_userId: { accountId, userId: user.id },
    },
  });

  if (!member) {
    throw new ForbiddenError("Você não é membro desta conta.");
  }

  return { user, member };
}
