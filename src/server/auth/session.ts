import { UnauthorizedError } from "@/server/api/errors";
import { auth } from "@/server/auth";
import { ensureMembership } from "@/server/auth/membership";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session.user as { id: string; email: string; name?: string | null };
}

export async function requireAccountAccess(accountId: string) {
  const user = await requireUser();
  const member = await ensureMembership(user.id, accountId);
  return { user, member };
}
