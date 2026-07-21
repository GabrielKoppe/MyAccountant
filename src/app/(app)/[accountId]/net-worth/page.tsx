import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { getNetWorthOverview, getNetWorthSeries } from "@/server/queries/net-worth";

import { NetWorthManager } from "./NetWorthManager";

type Props = { params: Promise<{ accountId: string }> };

export const metadata: Metadata = { title: "Patrimônio Líquido | MyAccountant" };

export default async function NetWorthPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const [overview, series, institutions] = await Promise.all([
    getNetWorthOverview(accountId),
    getNetWorthSeries(accountId, 12), // 12 meses no gráfico da hero
    prisma.institution.findMany({
      where: { accountId }, // ✅ multi-tenancy
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const canEdit = member.role === "owner" || member.role === "editor";

  return (
    <NetWorthManager
      accountId={accountId}
      overview={overview}
      series={series}
      institutions={institutions}
      canEdit={canEdit}
    />
  );
}
