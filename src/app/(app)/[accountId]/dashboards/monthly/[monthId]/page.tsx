import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import {
  getMonthDeepDive,
  getMonthSparklineData,
  getComparisonData,
  getDailyTotals,
  getCategoryTreemapData,
  getSankeyData,
} from "@/lib/queries/dashboards";
import { getMemberMonthlyBreakdown } from "@/lib/queries/member-analytics";
import { getBudgetsWithProgress, getBudgetFormOptions } from "@/lib/queries/budgets";
import { getLayout } from "@/server/services/dashboard-layout-service";
import { getKpiCustomDataMap } from "@/lib/queries/kpi-custom";
import { generateInsights } from "@/server/services/insights-service";
import { formatMonthLabel, getCurrentFiscalMonth, MONTH_NAMES } from "@/lib/dates";
import { getSandboxDataMap } from "@/lib/queries/sandbox";
import { AppLink } from "@/components/ui/AppLink";
import { MonthPickerNav } from "@/components/ui/MonthPickerNav";
import { MonthlyDashboardMenu } from "@/components/dashboards/monthly/MonthlyDashboardMenu";
import { MonthlyDashboardClient } from "@/components/dashboards/monthly/MonthlyDashboardClient";

type Props = { params: Promise<{ accountId: string; monthId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accountId, monthId } = await params;
  const [month, account] = await Promise.all([
    prisma.month.findFirst({
      where: { id: monthId, accountId },
      select: { year: true, month: true },
    }),
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true } }),
  ]);
  if (!month || !account) return { title: "MyAccountant" };
  const monthName = `${MONTH_NAMES[month.month - 1]} ${month.year}`;
  return { title: `Dashboard Mensal — ${monthName} | ${account.name} | MyAccountant` };
}

export default async function MonthlyDashboardPage({ params }: Props) {
  const { accountId, monthId } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const [monthMeta, allMonthsRaw, accountSettings] = await Promise.all([
    prisma.month.findFirst({
      where: { id: monthId, accountId },
      select: { year: true, month: true },
    }),
    prisma.month.findMany({
      where: { accountId },
      orderBy: [{ year: "asc" }, { month: "asc" }],
      select: { id: true, year: true, month: true },
    }),
    prisma.accountSettings.findUnique({
      where: { accountId },
      select: { monthStartDay: true },
    }),
  ]);

  if (!monthMeta) redirect(`/${accountId}/dashboards`);

  const { year, month } = monthMeta;
  const monthLabel = formatMonthLabel(year, month);

  // Mês fiscal atual? Define o texto prospectivo vs retrospectivo dos insights (INS-03).
  const fiscalNow = getCurrentFiscalMonth(new Date(), accountSettings?.monthStartDay ?? 1);
  const isCurrentMonth = fiscalNow.year === year && fiscalNow.month === month;

  // Fetch all data in parallel
  const [
    deepDive,
    sparklineData,
    comparisonData,
    treemapData,
    budgets,
    budgetFormOptions,
    widgets,
    insights,
    memberBreakdown,
  ] = await Promise.all([
    getMonthDeepDive(accountId, monthId),
    getMonthSparklineData(accountId, monthId),
    getComparisonData(accountId, monthId),
    getCategoryTreemapData(accountId, monthId),
    getBudgetsWithProgress(accountId, year, month),
    getBudgetFormOptions(accountId),
    getLayout(accountId, "monthly"),
    generateInsights(accountId, monthId, { isCurrentMonth }),
    getMemberMonthlyBreakdown(accountId, monthId),
  ]);

  const { sections, sectionTotals, monthTotal, topCategories, topTransactions } = deepDive;

  // Income / expense totals
  let incomeTotal = 0n;
  let expenseTotal = 0n;
  for (const s of sections) {
    const v = BigInt(sectionTotals[s.id] ?? "0");
    const abs = v < 0n ? -v : v;
    if (s.countType === "add") incomeTotal += abs;
    else if (s.countType === "subtract") expenseTotal += abs;
  }

  const pendingCount = await prisma.transaction.count({
    where: { accountId, monthId, isPending: true },
  });

  const topCategory = topCategories.length > 0 ? topCategories[0] : null;

  const subtractSectionIds = sections
    .filter((s) => s.countType === "subtract" || s.countType === "neutral")
    .map((s) => s.id);

  // daily-heatmap: modo "all_activity" mostra toda a atividade financeira (countInMonth);
  // modo "expense" (padrão) mostra apenas seções de saída.
  const heatmapConfig = widgets.find((w) => w.widgetId === "daily-heatmap")?.config as
    | { metric?: string }
    | undefined;
  const heatmapSectionIds = heatmapConfig?.metric === "all_activity" ? null : subtractSectionIds;
  const dailyTotals = await getDailyTotals(accountId, monthId, heatmapSectionIds);
  // money-flow: agrupa por seção ou categoria conforme a config da instância (spec 36 §2.2).
  const moneyFlowConfig = widgets.find((w) => w.widgetId === "money-flow")?.config as
    | { groupBy?: "section" | "category" }
    | undefined;
  const sankeyData = await getSankeyData(
    accountId,
    monthId,
    sections,
    sectionTotals,
    moneyFlowConfig?.groupBy ?? "category",
  );
  const kpiCustomData = await getKpiCustomDataMap(accountId, widgets, [monthId]);
  const analysisData = await getSandboxDataMap(accountId, widgets, { currentMonthId: monthId });

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Navigation header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Button
            component={AppLink}
            href={`/${accountId}/dashboards/yearly/${year}`}
            size="small"
            variant="text"
            sx={{ color: "text.secondary", fontWeight: "normal", px: 1, minWidth: 0 }}
          >
            Dashboards · {year}
          </Button>
          <Typography variant="body2" sx={{ color: "text.disabled" }}>
            /
          </Typography>
          <MonthPickerNav
            currentMonth={{ id: monthId, year, month }}
            months={allMonthsRaw}
            basePath={`/${accountId}/dashboards/monthly`}
          />
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Button
            variant="text"
            component={AppLink}
            href={`/${accountId}/months/${monthId}`}
            startIcon={<CalendarMonthIcon fontSize="small" />}
            sx={{ color: "text.secondary", whiteSpace: "nowrap" }}
          >
            Ver mês
          </Button>
          <MonthlyDashboardMenu
            csvUrl={`/api/v1/accounts/${accountId}/months/${monthId}/export/csv`}
            pdfUrl={`/api/v1/accounts/${accountId}/months/${monthId}/export/pdf`}
          />
        </Stack>
      </Stack>

      <MonthlyDashboardClient
        accountId={accountId}
        monthId={monthId}
        monthLabel={monthLabel}
        year={year}
        month={month}
        sections={sections}
        sectionTotals={sectionTotals}
        monthTotal={monthTotal}
        incomeTotal={incomeTotal.toString()}
        expenseTotal={expenseTotal.toString()}
        pendingCount={pendingCount}
        topCategory={topCategory}
        topCategories={topCategories}
        topTransactions={topTransactions}
        sparklineData={sparklineData}
        comparisonData={comparisonData}
        dailyTotals={dailyTotals}
        treemapData={treemapData}
        sankeyData={sankeyData}
        budgets={budgets}
        budgetFormOptions={budgetFormOptions}
        insights={insights}
        memberBreakdown={memberBreakdown}
        widgets={widgets}
        kpiCustomData={kpiCustomData}
        analysisData={analysisData}
      />
    </Box>
  );
}
