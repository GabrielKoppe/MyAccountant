import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { listSavedAnalyses } from "@/lib/queries/sandbox";
import { formatMonthLabel } from "@/lib/dates";
import { SandboxPage } from "@/components/dashboards/sandbox/SandboxPage";
import type { SandboxConfig } from "@/lib/schemas/sandbox";

type Props = {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ analysisId?: string }>;
};

const DEFAULT_CONFIG: SandboxConfig = {
  periodType: "year",
  year: new Date().getFullYear(),
  groupBy: "month",
  seriesBy: "section",
  metric: "total",
  chartType: "bar_grouped",
};

export default async function SandboxDashboardPage({ params, searchParams }: Props) {
  const { accountId } = await params;
  const { analysisId } = await searchParams;
  const { user, member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const [sections, categories, membersRaw, monthsRaw, savedAnalyses] = await Promise.all([
    prisma.section.findMany({
      where: { accountId },
      select: { id: true, name: true, countType: true },
      orderBy: { order: "asc" },
    }),
    prisma.category.findMany({
      where: { accountId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.accountMember.findMany({
      where: { accountId },
      select: { userId: true, user: { select: { name: true, email: true } } },
    }),
    prisma.month.findMany({
      where: { accountId },
      select: { id: true, year: true, month: true },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    }),
    listSavedAnalyses(accountId),
  ]);

  const allYears = [...new Set(monthsRaw.map((m) => m.year))].sort((a, b) => b - a);
  const allMonths = monthsRaw.map((m) => ({
    id: m.id,
    label: formatMonthLabel(m.year, m.month),
    year: m.year,
    month: m.month,
  }));

  const members = membersRaw.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? m.user.email ?? "Membro",
  }));

  const defaultYear = allYears[0] ?? new Date().getFullYear();
  const targetAnalysis = analysisId ? savedAnalyses.find((a) => a.id === analysisId) : undefined;
  const initialConfig: SandboxConfig = targetAnalysis?.config ?? { ...DEFAULT_CONFIG, year: defaultYear };

  return (
    <SandboxPage
      accountId={accountId}
      currentUserId={user.id}
      role={member.role}
      allYears={allYears}
      allMonths={allMonths}
      sections={sections}
      categories={categories}
      members={members}
      savedAnalyses={savedAnalyses}
      initialConfig={initialConfig}
    />
  );
}
