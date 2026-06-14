"use client";

import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SavingsIcon from "@mui/icons-material/Savings";
import ScienceIcon from "@mui/icons-material/Science";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import type { SectionMeta, CategorySum, MonthSummary } from "@/lib/queries/dashboards";
import type { PinnedAnalysisData } from "@/lib/queries/sandbox";
import type { MemberTrendSeries } from "@/lib/queries/member-analytics";

import { KpiSparklineCard } from "@/components/dashboards/kpi/KpiSparklineCard";
import { MonthlyBarChart } from "@/components/dashboards/charts/MonthlyBarChart";
import { CategoryBarList } from "@/components/dashboards/charts/CategoryBarList";
import { MonthCardGrid } from "@/components/dashboards/charts/MonthCardGrid";
import { MemberTrendChart } from "@/components/dashboards/charts/MemberTrendChart";
import { PinnedAnalysesSection } from "@/components/dashboards/panels/PinnedAnalysesSection";
import { DashboardWidgetRenderer } from "@/components/dashboards/_core/DashboardWidgetRenderer";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { AppLink } from "@/components/ui/AppLink";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { YearSelector } from "@/components/dashboards/_shared/YearSelector";
import { YearlyDashboardMenu } from "./YearlyDashboardMenu";
import type { WidgetDef } from "@/components/dashboards/_core/widget-registry";

type Props = {
  accountId: string;
  year: number;
  allYears: number[];
  csvUrl: string;
  // KPI values — pré-computados na page (server), serializados como string (centavos)
  yearTotal: string;
  monthAvg: string;
  yearlyIncome: string;
  yearlyExpense: string;
  savingsRate: number;
  monthCount: number;
  bestMonth: { label: string; total: string };
  worstMonth: { label: string; total: string };
  pendingCount: number;
  // Dados dos widgets
  monthSummaries: MonthSummary[];
  sections: SectionMeta[];
  topCategories: CategorySum[];
  pinnedAnalyses: PinnedAnalysisData[];
  memberTrend: MemberTrendSeries[];
  activeWidgets: WidgetDef[];
};

export function YearlyDashboardClient({
  accountId,
  year,
  allYears,
  csvUrl,
  yearTotal,
  monthAvg,
  yearlyIncome,
  yearlyExpense,
  savingsRate,
  monthCount,
  bestMonth,
  worstMonth,
  pendingCount,
  monthSummaries,
  sections,
  topCategories,
  pinnedAnalyses,
  memberTrend,
  activeWidgets,
}: Props) {
  const yearTotalBigInt = BigInt(yearTotal);
  const yearlyIncomeBigInt = BigInt(yearlyIncome);
  const yearlyExpenseBigInt = BigInt(yearlyExpense);

  const nodeMap: Record<string, React.ReactNode> = {
    "kpi-year-total": (
      <KpiSparklineCard
        title={m.dashboards.kpi.yearTotal}
        value={formatCentsToBrl(yearTotalBigInt)}
        subtitle={`${monthCount} ${monthCount === 1 ? "mês" : "meses"}`}
        color={yearTotalBigInt >= 0n ? "success" : "error"}
      />
    ),
    "kpi-income": (
      <KpiSparklineCard
        title={m.dashboards.kpi.income}
        value={formatCentsToBrl(yearlyIncomeBigInt)}
        color="success"
        icon={TrendingUpIcon}
      />
    ),
    "kpi-expenses": (
      <KpiSparklineCard
        title={m.dashboards.kpi.expenses}
        value={formatCentsToBrl(yearlyExpenseBigInt)}
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
        value={formatCentsToBrl(BigInt(monthAvg))}
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
  };

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
          <YearlyDashboardMenu csvUrl={csvUrl} />
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

      <DashboardWidgetRenderer active={activeWidgets} nodeMap={nodeMap} />
    </Box>
  );
}
