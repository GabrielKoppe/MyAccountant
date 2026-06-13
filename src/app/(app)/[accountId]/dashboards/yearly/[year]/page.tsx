import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SavingsIcon from "@mui/icons-material/Savings";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ScienceIcon from "@mui/icons-material/Science";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { getYearOverview } from "@/lib/queries/dashboards";
import { getMemberYearlyTrend } from "@/lib/queries/member-analytics";
import { getPinnedAnalyses } from "@/lib/queries/sandbox";
import { getLayout } from "@/server/services/dashboard-layout-service";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { AppLink } from "@/components/ui/AppLink";
import { YearlyDashboardMenu } from "@/components/dashboards/YearlyDashboardMenu";
import { KpiSparklineCard } from "@/components/dashboards/KpiSparklineCard";
import { MonthlyBarChart } from "@/components/dashboards/MonthlyBarChart";
import { CategoryBarList } from "@/components/dashboards/CategoryBarList";
import { YearSelector } from "@/components/dashboards/YearSelector";
import { MonthCardGrid } from "@/components/dashboards/MonthCardGrid";
import { PinnedAnalysesSection } from "@/components/dashboards/PinnedAnalysesSection";
import { MemberTrendChart } from "@/components/dashboards/MemberTrendChart";
import { DashboardWidgetRenderer } from "@/components/dashboards/DashboardWidgetRenderer";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/widget-icons";
import { Button } from "@mui/material";

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
    pinnedAnalyses,
    layout,
    memberTrend,
  ] = await Promise.all([
    getYearOverview(accountId, year),
    getPinnedAnalyses(accountId, "yearly"),
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

  // KPI calculations — all BigInt
  const monthTotals = monthSummaries.map((ms) => BigInt(ms.total));
  const yearTotal = monthTotals.reduce((sum, t) => sum + t, 0n);
  const monthAvg = monthTotals.length > 0 ? Number(yearTotal) / monthTotals.length : 0;

  const bestMonth = monthSummaries.reduce((best, ms) =>
    BigInt(ms.total) > BigInt(best.total) ? ms : best,
  );
  const worstMonth = monthSummaries.reduce((worst, ms) =>
    BigInt(ms.total) < BigInt(worst.total) ? ms : worst,
  );

  // Income / expense from sectionTotals across all months
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

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          mb: 3,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h5">{m.dashboards.yearlyTitle}</Typography>
          <YearSelector accountId={accountId} currentYear={year} allYears={allYears} />
        </Box>

        {/* Quick links + actions */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <YearlyDashboardMenu csvUrl={`/api/v1/accounts/${accountId}/years/${year}/export/csv`} />
          {allYears
            .filter((y) => y !== year)
            .slice(0, 3)
            .map((y) => (
              <Chip
                key={y}
                label={y}
                size="small"
                component={AppLink}
                href={`/${accountId}/dashboards/yearly/${y}`}
                clickable
                sx={{ fontSize: "0.75rem" }}
              />
            ))}
        </Box>
      </Box>

      <DashboardWidgetRenderer
        active={layout.active}
        nodeMap={{
          "kpi-year-total": (
            <KpiSparklineCard
              title={m.dashboards.kpi.yearTotal}
              value={formatCentsToBrl(yearTotal)}
              subtitle={`${monthSummaries.length} ${monthSummaries.length === 1 ? "mês" : "meses"}`}
              color={yearTotal >= 0n ? "success" : "error"}
            />
          ),
          "kpi-income": (
            <KpiSparklineCard
              title={m.dashboards.kpi.income}
              value={formatCentsToBrl(yearlyIncome)}
              color="success"
              icon={TrendingUpIcon}
            />
          ),
          "kpi-expenses": (
            <KpiSparklineCard
              title={m.dashboards.kpi.expenses}
              value={formatCentsToBrl(yearlyExpense)}
              color="error"
              icon={TrendingDownIcon}
            />
          ),
          "kpi-savings-rate": (
            <KpiSparklineCard
              title={m.dashboards.kpi.savingsRate}
              value={`${savingsRate}%`}
              subtitle={savingsRate < 0 ? "Deficit" : savingsRate < 10 ? "Atenção" : "Bom"}
              color={savingsRate >= 20 ? "success" : savingsRate >= 0 ? "warning" : "error"}
              icon={SavingsIcon}
            />
          ),
          "kpi-monthly-avg": (
            <KpiSparklineCard
              title={m.dashboards.kpi.monthlyAvg}
              value={formatCentsToBrl(BigInt(Math.round(monthAvg)))}
              icon={CalendarMonthIcon}
            />
          ),
          "kpi-best-month": (
            <KpiSparklineCard
              title={m.dashboards.kpi.bestMonth}
              value={formatCentsToBrl(BigInt(bestMonth.total))}
              subtitle={bestMonth.label}
              icon={TrendingUpIcon}
              color="success"
            />
          ),
          "kpi-worst-month": (
            <KpiSparklineCard
              title={m.dashboards.kpi.worstMonth}
              value={formatCentsToBrl(BigInt(worstMonth.total))}
              subtitle={worstMonth.label}
              icon={TrendingDownIcon}
              color={BigInt(worstMonth.total) < 0n ? "error" : "default"}
            />
          ),
          "kpi-pending":
            pendingCount > 0 ? (
              <KpiSparklineCard
                title={m.dashboards.kpi.pendingCount}
                value={String(pendingCount)}
                color="warning"
                icon={AccessTimeIcon}
              />
            ) : null,
          "month-card-grid": (
            <WidgetContainer
              title={m.dashboards.widgets.yearly["month-card-grid"]}
              icon={WIDGET_ICONS["month-card-grid"]}
            >
              <MonthCardGrid accountId={accountId} months={monthSummaries} />
            </WidgetContainer>
          ),
          "monthly-bar-chart": (
            <WidgetContainer
              title={m.dashboards.sections.monthlyChart}
              icon={WIDGET_ICONS["monthly-bar-chart"]}
              secondary={
                <Typography variant="caption" color="text.secondary">
                  Clique em uma barra para abrir o mês
                </Typography>
              }
            >
              <MonthlyBarChart
                months={monthSummaries}
                sections={sections}
                monthPagePrefix={`/${accountId}/dashboards/monthly/`}
              />
            </WidgetContainer>
          ),
          "pinned-analyses": (
            <WidgetContainer
              title={m.dashboards.sandbox.pinnedTitle}
              icon={WIDGET_ICONS["pinned-analyses"]}
              secondary={
                <Button
                  component={AppLink}
                  href={`/${accountId}/dashboards/sandbox`}
                  variant="outlined"
                  size="small"
                  startIcon={<ScienceIcon />}
                  sx={{ fontSize: "0.75rem" }}
                >
                  {m.dashboards.sandbox.openSandbox}
                </Button>
              }
              collapsible
            >
              <PinnedAnalysesSection accountId={accountId} pinnedAnalyses={pinnedAnalyses} />
            </WidgetContainer>
          ),
          "top-categories": (
            <WidgetContainer
              title={m.dashboards.sections.topCategories}
              icon={WIDGET_ICONS["top-categories"]}
            >
              <CategoryBarList categories={topCategories} />
            </WidgetContainer>
          ),
          "member-trend":
            memberTrend.length > 0 ? (
              <WidgetContainer
                title={m.dashboards.sections.memberTrend}
                icon={WIDGET_ICONS["member-trend"]}
              >
                <MemberTrendChart series={memberTrend} />
              </WidgetContainer>
            ) : null,
        }}
      />
    </Box>
  );
}
