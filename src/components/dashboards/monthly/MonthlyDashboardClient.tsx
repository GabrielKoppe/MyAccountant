"use client";

import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CategoryIcon from "@mui/icons-material/Category";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import SavingsIcon from "@mui/icons-material/Savings";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import dynamic from "next/dynamic";
import React, { useState, useTransition } from "react";

import { DashboardGrid } from "@/components/dashboards/_core/DashboardGrid";
import { DailyHeatmap } from "@/components/dashboards/charts/DailyHeatmap";
import {
  KpiCard,
  CategoryTreemap,
  MemberRadarWidget,
  WeeklySpendingWidget,
} from "@/components/dashboards/charts/lazy";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type {
  SectionMeta,
  CategorySum,
  MonthSparklineResult,
  ComparisonResult,
  DayTotal,
  TreemapCategory,
  SankeyData,
  DrillDownTransaction,
} from "@/server/queries/dashboards";
import type { KpiCustomResult } from "@/server/queries/kpi-custom";
import type { MemberBreakdownRow } from "@/server/queries/member-analytics";

import { DrillDownDrawer } from "@/components/dashboards/panels/DrillDownDrawer";

import type { Insight } from "@/server/services/insights-service";
import { TopTransactionTable } from "../panels/TopTransactionTable";
import { ComparisonToggle, type CompareMode } from "./ComparisonToggle";
import { InsightsCard } from "@/components/dashboards/panels/InsightsCard";
import { SectionBreakdownWidget } from "@/components/dashboards/panels/SectionBreakdownWidget";
import { CategoryBreakdownWidget } from "@/components/dashboards/panels/CategoryBreakdownWidget";
import { MemberBreakdownWidget } from "@/components/dashboards/panels/MemberBreakdownWidget";
import { MemberListWidget } from "@/components/dashboards/panels/MemberListWidget";
import { getRenderMode } from "@/components/dashboards/_core/widget-registry";
import { BudgetsWidget } from "@/components/budgets/BudgetsWidget";
import { BudgetHealthKpi } from "@/components/dashboards/kpi/BudgetHealthKpi";
import { InstitutionBreakdownWidget } from "@/components/dashboards/panels/InstitutionBreakdownWidget";
import type { BudgetProgress, BudgetFormOptions } from "@/server/queries/budgets";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import {
  kpiCustomConfigSchema,
  type CategoryBreakdownConfig,
  type PieChartConfig,
  type TopTransactionsConfig,
  type TreemapConfig,
} from "@/lib/schemas/widget-config";
import { KpiCustomWidget } from "@/components/dashboards/kpi/KpiCustomWidget";
import { AnalysisWidget } from "@/components/dashboards/panels/AnalysisWidget";
import type { SerializedSandboxResult } from "@/server/queries/sandbox";
import type { InstitutionBreakdownItem, WeeklySpendingItem } from "@/server/queries/dashboards";

// @nivo/sankey loaded client-only (no SSR — uses D3 hooks)
const SankeyChart = dynamic(
  () => import("@/components/dashboards/charts/SankeyChart").then((m) => m.SankeyChart),
  {
    ssr: false,
    loading: () => (
      <Box sx={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="caption" color="text.secondary">
          Carregando fluxo...
        </Typography>
      </Box>
    ),
  },
);

import type { TxRow } from "../panels/TopTransactionTable";

type Props = {
  accountId: string;
  monthId: string;
  monthLabel: string;
  year: number;
  month: number;
  sections: SectionMeta[];
  sectionTotals: Record<string, string>;
  monthTotal: string;
  incomeTotal: string;
  expenseTotal: string;
  pendingCount: number;
  topCategory: CategorySum | null;
  topCategories: CategorySum[];
  topTransactions: TxRow[];
  sparklineData: MonthSparklineResult;
  comparisonData: ComparisonResult;
  dailyTotals: DayTotal[];
  treemapData: TreemapCategory[];
  sankeyData: SankeyData;
  budgets: BudgetProgress[];
  budgetFormOptions: BudgetFormOptions;
  insights: Insight[];
  memberBreakdown: MemberBreakdownRow[];
  widgets: StoredWidget[];
  kpiCustomData: Record<string, KpiCustomResult>;
  analysisData: Record<string, SerializedSandboxResult>;
  heatmapColorBy?: "intensity" | "expense_type"; // Spec 41 Fase 14
  // Spec 38
  institutionBreakdown: InstitutionBreakdownItem[];
  weeklySpending: WeeklySpendingItem[];
  transactionCount: number;
  expenseCount?: number;
  incomeCount?: number;
};

function pickComparisonValues(
  mode: CompareMode,
  sparklineData: MonthSparklineResult,
  comparisonData: ComparisonResult,
): { total: string | null; income: string | null; expense: string | null } {
  if (mode === "prevMonth") {
    return {
      total: sparklineData.prevMonthTotal,
      income: sparklineData.prevMonthIncome,
      expense: sparklineData.prevMonthExpense,
    };
  }
  if (mode === "prevYear") {
    return {
      total: comparisonData.prevYearSameMonth?.total ?? null,
      income: comparisonData.prevYearSameMonth?.income ?? null,
      expense: comparisonData.prevYearSameMonth?.expense ?? null,
    };
  }
  if (mode === "avg3m") {
    return {
      total: comparisonData.avg3months?.total ?? null,
      income: comparisonData.avg3months?.income ?? null,
      expense: comparisonData.avg3months?.expense ?? null,
    };
  }
  return { total: null, income: null, expense: null };
}

export function MonthlyDashboardClient({
  accountId,
  monthId,
  year,
  month,
  sections,
  sectionTotals,
  monthTotal,
  incomeTotal,
  expenseTotal,
  pendingCount,
  topCategory,
  topCategories,
  topTransactions,
  sparklineData,
  comparisonData,
  dailyTotals,
  heatmapColorBy = "intensity",
  treemapData,
  sankeyData,
  budgets,
  budgetFormOptions,
  insights,
  memberBreakdown,
  widgets,
  kpiCustomData,
  analysisData,
  // Spec 38
  institutionBreakdown,
  weeklySpending,
  transactionCount,
  expenseCount,
  incomeCount,
}: Props) {
  const [compareMode, setCompareMode] = useState<CompareMode>("prevMonth");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("");
  const [drawerTxs, setDrawerTxs] = useState<DrillDownTransaction[]>([]);
  const [drawerLoading, startDrawerTransition] = useTransition();

  const compValues = pickComparisonValues(compareMode, sparklineData, comparisonData);
  const hasPrevYear = !!comparisonData.prevYearSameMonth;
  const hasAvg3m = !!comparisonData.avg3months;

  const totalBigInt = BigInt(monthTotal);
  const incomeBigInt = BigInt(incomeTotal);
  const expenseBigInt = BigInt(expenseTotal);
  const savingsRate =
    incomeBigInt > 0n
      ? Math.round(((Number(incomeBigInt) - Number(expenseBigInt)) / Number(incomeBigInt)) * 100)
      : 0;

  // Config interna por widget (singletons) — aplicada à apresentação.
  const configOf = (widgetId: string): unknown =>
    widgets.find((w) => w.widgetId === widgetId)?.config;

  // Comparação global → também a taxa de poupança (variação em pontos percentuais).
  const prevSavingsRate =
    compValues.income != null && compValues.expense != null && BigInt(compValues.income) > 0n
      ? Math.round(
          ((Number(BigInt(compValues.income)) - Number(BigInt(compValues.expense))) /
            Number(BigInt(compValues.income))) *
            100,
        )
      : null;

  function openDrawer(ids: string[], title: string) {
    setDrawerTitle(title);
    setDrawerOpen(true);
    startDrawerTransition(async () => {
      const txs = await fetchDrawerTransactions(accountId, ids);
      setDrawerTxs(txs);
    });
  }

  const kpiRm = (id: string) => getRenderMode(widgets, "monthly", id);

  const nodeByWidgetId: Record<string, React.ReactNode> = {
    "kpi-month-total": (
      <KpiCard
        title={m.dashboards.kpi.monthTotal}
        value={formatCentsToBrl(totalBigInt)}
        color={totalBigInt >= 0n ? "success" : "error"}
        renderMode={kpiRm("kpi-month-total")}
        sparkline={sparklineData.totalSparkline}
        currentCents={monthTotal}
        prevCents={compValues.total}
        deltaMode={compareMode}
      />
    ),
    "kpi-income": (
      <KpiCard
        title={m.dashboards.kpi.income}
        value={formatCentsToBrl(incomeBigInt)}
        color="success"
        icon={TrendingUpIcon}
        sparkline={sparklineData.incomeSparkline}
        currentCents={incomeTotal}
        prevCents={compValues.income}
        deltaMode={compareMode}
        renderMode={kpiRm("kpi-income")}
      />
    ),
    "kpi-expenses": (
      <KpiCard
        title={m.dashboards.kpi.expenses}
        value={formatCentsToBrl(expenseBigInt)}
        color="error"
        icon={TrendingDownIcon}
        sparkline={sparklineData.expenseSparkline}
        currentCents={expenseTotal}
        prevCents={compValues.expense}
        deltaMode={compareMode}
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
        deltaPp={{ current: savingsRate, prev: prevSavingsRate }}
        deltaMode={compareMode}
        renderMode={kpiRm("kpi-savings-rate")}
      />
    ),
    "kpi-top-category": (
      <KpiCard
        title={m.dashboards.kpi.topCategory}
        value={topCategory ? formatCentsToBrl(BigInt(topCategory.totalCents)) : "—"}
        subtitle={topCategory?.name}
        color="info"
        icon={CategoryIcon}
        renderMode={kpiRm("kpi-top-category")}
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
    budgets: (
      <BudgetsWidget
        budgets={budgets}
        accountId={accountId}
        monthId={monthId}
        formOptions={budgetFormOptions}
        config={
          configOf("budgets") as import("@/lib/schemas/widget-config").BudgetsConfig | undefined
        }
        renderMode={getRenderMode(widgets, "monthly", "budgets") as "compact" | "default" | "full"}
      />
    ),
    "daily-heatmap": (
      <DailyHeatmap
        year={year}
        month={month}
        dailyTotals={dailyTotals}
        colorBy={heatmapColorBy}
        onDayClick={(ids, day) => openDrawer(ids, `Gastos do dia ${day}/${month}/${year}`)}
        monthSummaryHref={`/${accountId}/months/${monthId}`}
      />
    ),
    "category-treemap": (
      <CategoryTreemap
        categories={treemapData}
        config={configOf("category-treemap") as TreemapConfig | undefined}
        onDrillDown={(ids, label) => openDrawer(ids, label)}
      />
    ),
    "money-flow": (
      <SankeyChart
        data={sankeyData}
        monthSummaryHref={`/${accountId}/months/${monthId}`}
        renderMode={getRenderMode(widgets, "monthly", "money-flow")}
      />
    ),
    "section-breakdown": (
      <SectionBreakdownWidget
        sections={sections}
        sectionTotals={sectionTotals}
        config={configOf("section-breakdown") as PieChartConfig | undefined}
        renderMode={
          getRenderMode(widgets, "monthly", "section-breakdown") as "compact" | "default" | "full"
        }
      />
    ),
    "category-breakdown": (
      <CategoryBreakdownWidget
        categories={topCategories}
        config={configOf("category-breakdown") as CategoryBreakdownConfig | undefined}
        renderMode={
          getRenderMode(widgets, "monthly", "category-breakdown") as "compact" | "default" | "full"
        }
      />
    ),
    insights: (
      <InsightsCard
        insights={insights}
        renderMode={getRenderMode(widgets, "monthly", "insights") as "compact" | "default" | "full"}
      />
    ),
    "member-breakdown": (
      <MemberBreakdownWidget
        rows={memberBreakdown}
        config={configOf("member-breakdown") as PieChartConfig | undefined}
        renderMode={
          getRenderMode(widgets, "monthly", "member-breakdown") as "compact" | "default" | "full"
        }
      />
    ),
    "member-list": (
      <MemberListWidget
        rows={memberBreakdown}
        renderMode={
          getRenderMode(widgets, "monthly", "member-list") as "compact" | "default" | "full"
        }
      />
    ),
    "member-radar": (
      <MemberRadarWidget
        rows={memberBreakdown}
        renderMode={getRenderMode(widgets, "monthly", "member-radar") as "compact" | "default"}
      />
    ),
    "top-transactions": (
      <TopTransactionTable
        transactions={topTransactions}
        config={configOf("top-transactions") as TopTransactionsConfig | undefined}
      />
    ),
    // ─── Spec 38 ────────────────────────────────────────────────────────────
    "kpi-budget-health": (
      <BudgetHealthKpi budgets={budgets} renderMode={kpiRm("kpi-budget-health")} />
    ),
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
    "institution-breakdown": (
      <InstitutionBreakdownWidget
        data={institutionBreakdown}
        config={
          configOf("institution-breakdown") as
            | import("@/lib/schemas/widget-config").PieChartConfig
            | undefined
        }
        renderMode={
          getRenderMode(widgets, "monthly", "institution-breakdown") as
            | "compact"
            | "default"
            | "full"
        }
      />
    ),
    "week-chart": (
      <WeeklySpendingWidget
        data={weeklySpending}
        metric={
          (
            configOf("week-chart") as
              | import("@/lib/schemas/widget-config").WeekChartConfig
              | undefined
          )?.metric ?? "expense"
        }
        renderMode={
          getRenderMode(widgets, "monthly", "week-chart") as "compact" | "default" | "expanded"
        }
      />
    ),
  };

  // nodeMap por instanceId: singletons resolvem pelo widgetId; instâncias
  // kpi-custom têm config + dados próprios por instância; analysis têm dados por instância.
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
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 4 }}>
        <ComparisonToggle
          value={compareMode}
          onChange={setCompareMode}
          hasPrevYear={hasPrevYear}
          hasAvg3m={hasAvg3m}
        />
      </Box>

      <DashboardGrid widgets={widgets} nodeMap={nodeMap} cols={6} />

      <DrillDownDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerTitle}
        transactions={drawerTxs}
        loading={drawerLoading}
      />
    </Box>
  );
}

// Client-side fetch of transactions for drill-down
// Uses a direct import to call the action from client
async function fetchDrawerTransactions(
  accountId: string,
  ids: string[],
): Promise<DrillDownTransaction[]> {
  const { getDrawerTransactionsAction } = await import("@/actions/dashboards");
  const result = await getDrawerTransactionsAction(accountId, ids);
  return result.ok ? result.data : [];
}
