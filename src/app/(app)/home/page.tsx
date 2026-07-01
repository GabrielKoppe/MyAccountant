import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { prisma } from "@/server/prisma";
import { getPendingInviteForEmail } from "@/server/services/member-service";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await prisma.accountMember.findMany({
    where: { userId: session.user.id },
    select: { accountId: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) {
    // Rede de segurança: se o usuário não tem account mas foi convidado, leva ao aceite
    // do convite em vez de forçar a criação de uma account nova (onboarding).
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });
    if (user) {
      const invite = await getPendingInviteForEmail(user.email);
      if (invite) redirect(`/invite/accept?token=${invite.token}`);
    }
    redirect("/onboarding");
  }
  if (memberships.length === 1) redirect(`/${memberships[0].accountId}`);
  redirect("/select-account");
}
