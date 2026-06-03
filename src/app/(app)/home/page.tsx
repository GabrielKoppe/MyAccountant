import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { prisma } from "@/server/prisma";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await prisma.accountMember.findMany({
    where: { userId: session.user.id },
    select: { accountId: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) redirect("/onboarding");
  if (memberships.length === 1) redirect(`/${memberships[0].accountId}`);
  redirect("/select-account");
}
