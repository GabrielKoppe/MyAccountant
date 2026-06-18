"use client";

import dynamic from "next/dynamic";
import React, { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import type {
  SectionMeta,
  CategorySum,
  MonthSparklineResult,
  ComparisonResult,
  DayTotal,
  TreemapCategory,
  SankeyData,
  DrillDownTransaction,
} from "@/lib/queries/dashboards";
import type { MemberBreakdownRow } from "@/lib/queries/member-analytics";

import { KpiSparklineCard } from "@/components/dashboards/kpi/KpiSparklineCard";
import {
  MemberBreakdownChart,
  MemberBreakdownChartSecondary,
  MemberBreakdownView,
} from "@/components/dashboards/panels/MemberBreakdownChart";
import { DailyHeatmap } from "@/components/dashboards/charts/DailyHeatmap";
import { CategoryTreemap } from "@/components/dashboards/charts/CategoryTreemap";
import { DrillDownDrawer } from "@/components/dashboards/panels/DrillDownDrawer";
import { ComparisonToggle, type CompareMode } from "./ComparisonToggle";
import { InsightsCard } from "@/components/dashboards/panels/InsightsCard";
import { SectionBreakdownWidget } from "@/components/dashboards/panels/SectionBreakdownWidget";
import { CategoryBreakdownWidget } from "@/components/dashboards/panels/CategoryBreakdownWidget";
import { DashboardGrid } from "@/components/dashboards/_core/DashboardGrid";
import { getRenderMode } from "@/components/dashboards/_core/widget-registry";
import { TopTransactionTable } from "../panels/TopTransactionTable";
import { BudgetsWidget } from "@/components/budgets/BudgetsWidget";
import type { Insight } from "@/server/services/insights-service";
import type { BudgetProgress, BudgetFormOptions } from "@/lib/queries/budgets";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import {
  kpiCustomConfigSchema,
  type MemberBreakdownConfig,
  type PieChartConfig,
  type TopTransactionsConfig,
  type TreemapConfig,
} from "@/lib/schemas/widget-config";
import type { KpiCustomResult } from "@/lib/queries/kpi-custom";
import { KpiCustomWidget } from "@/components/dashboards/kpi/KpiCustomWidget";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SavingsIcon from "@mui/icons-material/Savings";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CategoryIcon from "@mui/icons-material/Category";
import AddIcon from "@mui/icons-material/Add";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";

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
  treemapData,
  sankeyData,
  budgets,
  budgetFormOptions,
  insights,
  memberBreakdown,
  widgets,
  kpiCustomData,
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

  const subtractSections = sections.filter(
    (s) => s.countType === "subtract" || s.countType === "neutral",
  );

  // Config interna por widget (singletons) — aplicada à apresentação.
  const configOf = (widgetId: string): unknown =>
    widgets.find((w) => w.widgetId === widgetId)?.config;

  const treemapTopN = (configOf("category-treemap") as TreemapConfig | undefined)?.topN ?? "all";
  const treemapShown = treemapTopN === "all" ? treemapData : treemapData.slice(0, treemapTopN);

  // member-breakdown: view inicializada da config persistida; o toggle in-widget altera apenas o estado local.
  const memberBreakdownDefaultView =
    (configOf("member-breakdown") as MemberBreakdownConfig | undefined)?.view ?? "donut";
  const [view, setView] = useState<MemberBreakdownView>(memberBreakdownDefaultView);

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
      <KpiSparklineCard
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
      <KpiSparklineCard
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
      <KpiSparklineCard
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
      <KpiSparklineCard
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
    "kpi-top-category": topCategory ? (
      <KpiSparklineCard
        title={m.dashboards.kpi.topCategory}
        value={formatCentsToBrl(BigInt(topCategory.totalCents))}
        subtitle={topCategory.name}
        color="info"
        icon={CategoryIcon}
        renderMode={kpiRm("kpi-top-category")}
      />
    ) : null,
    "kpi-pending":
      pendingCount > 0 ? (
        <KpiSparklineCard
          title={m.dashboards.kpi.pendingCount}
          value={String(pendingCount)}
          color="warning"
          icon={AccessTimeIcon}
          renderMode={kpiRm("kpi-pending")}
        />
      ) : null,
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
        onDayClick={(ids, day) => openDrawer(ids, `Gastos do dia ${day}/${month}/${year}`)}
        monthSummaryHref={`/${accountId}/months/${monthId}`}
      />
    ),
    "category-treemap": (
      <WidgetContainer
        title={m.dashboards.sections.categoryTreemap}
        icon={WIDGET_ICONS["category-treemap"]}
      >
        <CategoryTreemap
          categories={treemapShown}
          onDrillDown={(ids, label) => openDrawer(ids, label)}
        />
      </WidgetContainer>
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
        config={configOf("category-breakdown") as PieChartConfig | undefined}
        renderMode={
          getRenderMode(widgets, "monthly", "category-breakdown") as "compact" | "default" | "full"
        }
      />
    ),
    insights: (
      <WidgetContainer title={m.dashboards.insights.cardTitle} icon={WIDGET_ICONS["insights"]}>
        <InsightsCard insights={insights} />
      </WidgetContainer>
    ),
    "member-breakdown": memberBreakdown.some((r) => BigInt(r.totalCents) > 0n) ? (
      <WidgetContainer
        title={m.dashboards.sections.memberBreakdown}
        icon={WIDGET_ICONS["member-breakdown"]}
        secondary={<MemberBreakdownChartSecondary view={view} onChange={setView} />}
      >
        <MemberBreakdownChart rows={memberBreakdown} view={{ type: view, onChange: setView }} />
      </WidgetContainer>
    ) : null,
    "top-transactions": (
      <TopTransactionTable
        transactions={topTransactions}
        config={configOf("top-transactions") as TopTransactionsConfig | undefined}
      />
    ),
  };

  // nodeMap por instanceId: singletons resolvem pelo widgetId; instâncias
  // kpi-custom têm config + dados próprios por instância.
  const nodeMap: Record<string, React.ReactNode> = {};
  for (const w of widgets) {
    if (w.widgetId === "kpi-custom") {
      const parsed = kpiCustomConfigSchema.safeParse(w.config);
      const config = parsed.success ? parsed.data : kpiCustomConfigSchema.parse({});
      const data = kpiCustomData[w.instanceId];
      nodeMap[w.instanceId] = data ? <KpiCustomWidget config={config} data={data} /> : null;
    } else {
      nodeMap[w.instanceId] = nodeByWidgetId[w.widgetId] ?? null;
    }
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
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
