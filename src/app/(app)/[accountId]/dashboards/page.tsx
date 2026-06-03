import { redirect } from "next/navigation";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";

type Props = { params: Promise<{ accountId: string }> };

export default async function DashboardsPage({ params }: Props) {
  const { accountId } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const latestMonth = await prisma.month.findFirst({
    where: { accountId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { year: true },
  });

  const year = latestMonth?.year ?? new Date().getFullYear();
  redirect(`/${accountId}/dashboards/yearly/${year}`);
}
