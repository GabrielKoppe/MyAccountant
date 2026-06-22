"use client";

import React from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import SavingsIcon from "@mui/icons-material/Savings";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import type { SectionMeta, CategorySum, MonthSummary } from "@/lib/queries/dashboards";
import type { MemberTrendSeries, MemberBreakdownRow } from "@/lib/queries/member-analytics";

import { KpiCard, MonthlyBarChart, MemberTrendChart } from "@/components/dashboards/charts/lazy";
import { TopCategoriesWidget } from "@/components/dashboards/panels/TopCategoriesWidget";
import { MonthCardGrid } from "@/components/dashboards/charts/MonthCardGrid";
import { MemberYearlyWidget } from "@/components/dashboards/panels/MemberYearlyWidget";
import { DashboardGrid } from "@/components/dashboards/_core/DashboardGrid";
import { AppLink } from "@/components/ui/AppLink";
import { YearSelector } from "@/components/dashboards/_shared/YearSelector";
import { YearlyDashboardMenu } from "./YearlyDashboardMenu";
import { getRenderMode } from "@/components/dashboards/_core/widget-registry";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import { kpiCustomConfigSchema, type TopCategoriesConfig } from "@/lib/schemas/widget-config";
import type { KpiCustomResult } from "@/lib/queries/kpi-custom";
import { KpiCustomWidget } from "@/components/dashboards/kpi/KpiCustomWidget";
import { AnalysisWidget } from "@/components/dashboards/panels/AnalysisWidget";
import type { SerializedSandboxResult } from "@/lib/queries/sandbox";

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
  memberTrend: MemberTrendSeries[];
  widgets: StoredWidget[];
  kpiCustomData: Record<string, KpiCustomResult>;
  analysisData: Record<string, SerializedSandboxResult>;
  // Spec 38
  memberYearly: MemberBreakdownRow[];
  transactionCount: number;
  expenseCount?: number;
  incomeCount?: number;
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
  memberTrend,
  widgets,
  kpiCustomData,
  analysisData,
  // Spec 38
  memberYearly,
  transactionCount,
  expenseCount,
  incomeCount,
}: Props) {
  const yearTotalBigInt = BigInt(yearTotal);
  const yearlyIncomeBigInt = BigInt(yearlyIncome);
  const yearlyExpenseBigInt = BigInt(yearlyExpense);

  // Config interna por widget (singletons)
  const configOf = (widgetId: string): unknown =>
    widgets.find((w) => w.widgetId === widgetId)?.config;

  const kpiRm = (id: string) => getRenderMode(widgets, "yearly", id);

  const nodeByWidgetId: Record<string, React.ReactNode> = {
    "kpi-year-total": (
      <KpiCard
        title={m.dashboards.kpi.yearTotal}
        value={formatCentsToBrl(yearTotalBigInt)}
        subtitle={`${monthCount} ${monthCount === 1 ? "mês" : "meses"}`}
        color={yearTotalBigInt >= 0n ? "success" : "error"}
        renderMode={kpiRm("kpi-year-total")}
      />
    ),
    "kpi-income": (
      <KpiCard
        title={m.dashboards.kpi.income}
        value={formatCentsToBrl(yearlyIncomeBigInt)}
        color="success"
        icon={TrendingUpIcon}
        renderMode={kpiRm("kpi-income")}
      />
    ),
    "kpi-expenses": (
      <KpiCard
        title={m.dashboards.kpi.expenses}
        value={formatCentsToBrl(yearlyExpenseBigInt)}
        color="error"
        icon={TrendingDownIcon}
        renderMode={kpiRm("kpi-expenses")}
      />
    ),
    "kpi-savings-rate": (
      <KpiCard
        title={m.dashboards.kpi.savingsRate}
        value={`${savingsRate}%`}
        subtitle={savingsRate < 0 ? "Deficit" : savingsRate < 10 ? "Atenção" : "Bom"}
        color={savingsRate >= 20 ? "success" : savingsRate >= 0 ? "warning" : "error"}
        icon={SavingsIcon}
        renderMode={kpiRm("kpi-savings-rate")}
      />
    ),
    "kpi-monthly-avg": (
      <KpiCard
        title={m.dashboards.kpi.monthlyAvg}
        value={formatCentsToBrl(BigInt(monthAvg))}
        icon={CalendarMonthIcon}
        renderMode={kpiRm("kpi-monthly-avg")}
      />
    ),
    "kpi-best-month": (
      <KpiCard
        title={m.dashboards.kpi.bestMonth}
        value={formatCentsToBrl(BigInt(bestMonth.total))}
        subtitle={bestMonth.label}
        icon={TrendingUpIcon}
        color="success"
        renderMode={kpiRm("kpi-best-month")}
      />
    ),
    "kpi-worst-month": (
      <KpiCard
        title={m.dashboards.kpi.worstMonth}
        value={formatCentsToBrl(BigInt(worstMonth.total))}
        subtitle={worstMonth.label}
        icon={TrendingDownIcon}
        color={BigInt(worstMonth.total) < 0n ? "error" : "default"}
        renderMode={kpiRm("kpi-worst-month")}
      />
    ),
    "kpi-pending": (
      <KpiCard
        title={m.dashboards.kpi.pendingCount}
        value={String(pendingCount)}
        color={pendingCount > 0 ? "warning" : "default"}
        icon={AccessTimeIcon}
        renderMode={kpiRm("kpi-pending")}
      />
    ),
    "month-card-grid": (
      <MonthCardGrid
        accountId={accountId}
        months={monthSummaries}
        renderMode={getRenderMode(widgets, "yearly", "month-card-grid")}
      />
    ),
    "monthly-bar-chart": (
      <MonthlyBarChart
        months={monthSummaries}
        sections={sections}
        monthDashboardPrefix={`/${accountId}/dashboards/monthly/`}
        renderMode={getRenderMode(widgets, "yearly", "monthly-bar-chart")}
      />
    ),
    "top-categories": (
      <TopCategoriesWidget
        categories={topCategories}
        config={configOf("top-categories") as TopCategoriesConfig | undefined}
        renderMode={getRenderMode(widgets, "yearly", "top-categories")}
      />
    ),
    "member-trend": (
      <MemberTrendChart
        series={memberTrend}
        renderMode={getRenderMode(widgets, "yearly", "member-trend")}
      />
    ),
    // ─── Spec 38 ───────────────────────────────────────────────────────────
    "kpi-transaction-count": (
      <KpiCard
        title={m.dashboards.kpi.transactionCount}
        value={String(transactionCount)}
        color="info"
        icon={FormatListNumberedIcon}
        breakdown={
          expenseCount != null && incomeCount != null
            ? [
                { label: "Saídas", value: String(expenseCount), dotColor: "error.main" },
                { label: "Entradas", value: String(incomeCount), dotColor: "success.main" },
              ]
            : undefined
        }
        renderMode={kpiRm("kpi-transaction-count")}
      />
    ),
    "member-yearly": (
      <MemberYearlyWidget
        rows={memberYearly}
        config={
          configOf("member-yearly") as
            | import("@/lib/schemas/widget-config").PieChartConfig
            | undefined
        }
        renderMode={
          getRenderMode(widgets, "yearly", "member-yearly") as "compact" | "default" | "expanded"
        }
      />
    ),
  };

  // nodeMap por instanceId: singletons pelo widgetId; kpi-custom por instância; analysis por instância.
  const nodeMap: Record<string, React.ReactNode> = {};
  for (const w of widgets) {
    if (w.widgetId === "kpi-custom") {
      const parsed = kpiCustomConfigSchema.safeParse(w.config);
      const config = parsed.success ? parsed.data : kpiCustomConfigSchema.parse({});
      nodeMap[w.instanceId] = (
        <KpiCustomWidget config={config} data={kpiCustomData[w.instanceId] ?? null} />
      );
    } else if (w.widgetId === "analysis") {
      nodeMap[w.instanceId] = (
        <AnalysisWidget
          rawConfig={w.config}
          data={analysisData[w.instanceId] ?? null}
          sizeVariantId={w.sizeVariantId}
        />
      );
    } else {
      nodeMap[w.instanceId] = nodeByWidgetId[w.widgetId] ?? null;
    }
  }

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

      <DashboardGrid widgets={widgets} nodeMap={nodeMap} cols={6} />
    </Box>
  );
}
