import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SavingsIcon from "@mui/icons-material/Savings";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import { requireAccountAccess } from "@/server/auth/session";
import { getYearOverview } from "@/lib/queries/dashboards";
import { getPinnedAnalyses } from "@/lib/queries/sandbox";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { AppLink } from "@/components/ui/AppLink";
import { KpiSparklineCard } from "@/components/dashboards/KpiSparklineCard";
import { MonthlyBarChart } from "@/components/dashboards/MonthlyBarChart";
import { CategoryBarList } from "@/components/dashboards/CategoryBarList";
import { YearSelector } from "@/components/dashboards/YearSelector";
import { MonthCardGrid } from "@/components/dashboards/MonthCardGrid";
import { PinnedAnalysesSection } from "@/components/dashboards/PinnedAnalysesSection";

type Props = { params: Promise<{ accountId: string; year: string }> };

export default async function YearlyDashboardPage({ params }: Props) {
  const { accountId, year: yearStr } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const year = parseInt(yearStr);
  if (isNaN(year)) redirect(`/${accountId}/dashboards`);

  const [{ sections, monthSummaries, topCategories, pendingCount, allYears }, pinnedAnalyses] =
    await Promise.all([
      getYearOverview(accountId, year),
      getPinnedAnalyses(accountId, "yearly"),
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
          <Typography variant="h5">
            {m.dashboards.yearlyTitle}
          </Typography>
          <YearSelector accountId={accountId} currentYear={year} allYears={allYears} />
        </Box>

        {/* Quick links to adjacent years */}
        <Box sx={{ display: "flex", gap: 1 }}>
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

      {/* KPI grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" },
          gap: 2,
          mb: 3,
        }}
      >
        <KpiSparklineCard
          title={m.dashboards.kpi.yearTotal}
          value={formatCentsToBrl(yearTotal)}
          subtitle={`${monthSummaries.length} ${monthSummaries.length === 1 ? "mês" : "meses"}`}
          color={yearTotal >= 0n ? "success" : "error"}
        />
        <KpiSparklineCard
          title={m.dashboards.kpi.income}
          value={formatCentsToBrl(yearlyIncome)}
          color="success"
          icon={TrendingUpIcon}
        />
        <KpiSparklineCard
          title={m.dashboards.kpi.expenses}
          value={formatCentsToBrl(yearlyExpense)}
          color="error"
          icon={TrendingDownIcon}
        />
        <KpiSparklineCard
          title={m.dashboards.kpi.savingsRate}
          value={`${savingsRate}%`}
          subtitle={savingsRate < 0 ? "Deficit" : savingsRate < 10 ? "Atenção" : "Bom"}
          color={savingsRate >= 20 ? "success" : savingsRate >= 0 ? "warning" : "error"}
          icon={SavingsIcon}
        />
        <KpiSparklineCard
          title={m.dashboards.kpi.monthlyAvg}
          value={formatCentsToBrl(BigInt(Math.round(monthAvg)))}
          icon={CalendarMonthIcon}
        />
        <KpiSparklineCard
          title={m.dashboards.kpi.bestMonth}
          value={formatCentsToBrl(BigInt(bestMonth.total))}
          subtitle={bestMonth.label}
          icon={TrendingUpIcon}
          color="success"
        />
        <KpiSparklineCard
          title={m.dashboards.kpi.worstMonth}
          value={formatCentsToBrl(BigInt(worstMonth.total))}
          subtitle={worstMonth.label}
          icon={TrendingDownIcon}
          color={BigInt(worstMonth.total) < 0n ? "error" : "default"}
        />
        {pendingCount > 0 && (
          <KpiSparklineCard
            title={m.dashboards.kpi.pendingCount}
            value={String(pendingCount)}
            color="warning"
            icon={AccessTimeIcon}
          />
        )}
      </Box>

      {/* Month card grid */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <MonthCardGrid accountId={accountId} months={monthSummaries} />
      </Paper>

      {/* Bar chart — months × sections */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1.5,
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold">
            {m.dashboards.sections.monthlyChart}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Clique em uma barra para abrir o mês
          </Typography>
        </Box>
        <MonthlyBarChart
          months={monthSummaries}
          sections={sections}
          monthPagePrefix={`/${accountId}/dashboards/monthly/`}
        />
      </Paper>

      {/* Pinned analyses */}
      <Box sx={{ mb: 3 }}>
        <PinnedAnalysesSection accountId={accountId} pinnedAnalyses={pinnedAnalyses} />
      </Box>

      {/* Top categories */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          {m.dashboards.sections.topCategories}
        </Typography>
        <CategoryBarList categories={topCategories} />
      </Paper>
    </Box>
  );
}
