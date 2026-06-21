import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { getYearOverview } from "@/lib/queries/dashboards";
import { getMemberYearlyTrend } from "@/lib/queries/member-analytics";
import { getLayout } from "@/server/services/dashboard-layout-service";
import { getKpiCustomDataMap } from "@/lib/queries/kpi-custom";
import { getSandboxDataMap } from "@/lib/queries/sandbox";
import { m } from "@/lib/messages";
import { YearlyDashboardClient } from "@/components/dashboards/yearly/YearlyDashboardClient";

type Props = { params: Promise<{ accountId: string; year: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accountId, year: yearStr } = await params;
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { name: true },
  });
  if (!account) return { title: "MyAccountant" };
  return { title: `Dashboard Anual — ${yearStr} | ${account.name} | MyAccountant` };
}

export default async function YearlyDashboardPage({ params }: Props) {
  const { accountId, year: yearStr } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const year = parseInt(yearStr);
  if (isNaN(year)) redirect(`/${accountId}/dashboards`);

  const [
    { sections, monthSummaries, topCategories, pendingCount, allYears },
    widgets,
    memberTrend,
  ] = await Promise.all([
    getYearOverview(accountId, year),
    getLayout(accountId, "yearly"),
    getMemberYearlyTrend(accountId, year),
  ]);

  if (monthSummaries.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {m.dashboards.noData}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {m.dashboards.noDataHint}
        </Typography>
      </Box>
    );
  }

  // KPI calculations — all BigInt, serialized as strings for the client component
  const monthTotals = monthSummaries.map((ms) => BigInt(ms.total));
  const yearTotal = monthTotals.reduce((sum, t) => sum + t, 0n);
  const monthAvg = monthTotals.length > 0 ? Math.round(Number(yearTotal) / monthTotals.length) : 0;

  const bestMonth = monthSummaries.reduce((best, ms) =>
    BigInt(ms.total) > BigInt(best.total) ? ms : best,
  );
  const worstMonth = monthSummaries.reduce((worst, ms) =>
    BigInt(ms.total) < BigInt(worst.total) ? ms : worst,
  );

  let yearlyIncome = 0n;
  let yearlyExpense = 0n;
  for (const ms of monthSummaries) {
    for (const section of sections) {
      const v = BigInt(ms.sectionTotals[section.id] ?? "0");
      const abs = v < 0n ? -v : v;
      if (section.countType === "add") yearlyIncome += abs;
      else if (section.countType === "subtract") yearlyExpense += abs;
    }
  }
  const savingsRate =
    yearlyIncome > 0n
      ? Math.round((Number(yearlyIncome - yearlyExpense) / Number(yearlyIncome)) * 100)
      : 0;

  // kpi-custom: período = todos os meses do ano.
  const yearMonthIds = monthSummaries.map((ms) => ms.id);
  const kpiCustomData = await getKpiCustomDataMap(accountId, widgets, yearMonthIds);
  const analysisData = await getSandboxDataMap(accountId, widgets, { currentYear: year });

  return (
    <YearlyDashboardClient
      accountId={accountId}
      year={year}
      allYears={allYears as number[]}
      csvUrl={`/api/v1/accounts/${accountId}/years/${year}/export/csv`}
      yearTotal={yearTotal.toString()}
      monthAvg={monthAvg.toString()}
      yearlyIncome={yearlyIncome.toString()}
      yearlyExpense={yearlyExpense.toString()}
      savingsRate={savingsRate}
      monthCount={monthSummaries.length}
      bestMonth={{ label: bestMonth.label, total: bestMonth.total }}
      worstMonth={{ label: worstMonth.label, total: worstMonth.total }}
      pendingCount={pendingCount}
      monthSummaries={monthSummaries}
      sections={sections}
      topCategories={topCategories}
      memberTrend={memberTrend}
      widgets={widgets}
      kpiCustomData={kpiCustomData}
      analysisData={analysisData}
    />
  );
}
