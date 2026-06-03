import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { NoMonthsState } from "@/components/months/NoMonthsState";

type Props = { params: Promise<{ accountId: string }> };

export default async function AccountPage({ params }: Props) {
  const { accountId } = await params;

  await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const latestMonth = await prisma.month.findFirst({
    where: { accountId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { id: true },
  });

  if (latestMonth) {
    redirect(`/${accountId}/months/${latestMonth.id}`);
  }

  return <NoMonthsState accountId={accountId} />;
}
