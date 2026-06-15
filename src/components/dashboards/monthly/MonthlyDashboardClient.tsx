"use client";

import dynamic from "next/dynamic";
import React, { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
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
import { CategoryPieChart } from "@/components/dashboards/charts/CategoryPieChart";
import { DrillDownDrawer } from "@/components/dashboards/panels/DrillDownDrawer";
import { ComparisonToggle, type CompareMode } from "./ComparisonToggle";
import { SectionPieChart } from "@/components/dashboards/charts/SectionPieChart";
import { InsightsCard } from "@/components/dashboards/panels/InsightsCard";
import { DashboardWidgetRenderer } from "@/components/dashboards/_core/DashboardWidgetRenderer";
import { TopTransactionTable } from "../panels/TopTransactionTable";
import { BudgetWidgetContent } from "@/components/budgets/BudgetWidgetContent";
import type { Insight } from "@/server/services/insights-service";
import { BudgetFormDialog } from "@/components/budgets/BudgetFormDialog";
import type { BudgetProgress, BudgetFormOptions } from "@/lib/queries/budgets";
import type { WidgetDef } from "@/components/dashboards/_core/widget-registry";
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
  activeWidgets: WidgetDef[];
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
  activeWidgets,
}: Props) {
  const [compareMode, setCompareMode] = useState<CompareMode>("prevMonth");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("");
  const [drawerTxs, setDrawerTxs] = useState<DrillDownTransaction[]>([]);
  const [drawerLoading, startDrawerTransition] = useTransition();
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const [view, setView] = useState<MemberBreakdownView>("donut");

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

  function openDrawer(ids: string[], title: string) {
    setDrawerTitle(title);
    setDrawerOpen(true);
    startDrawerTransition(async () => {
      const txs = await fetchDrawerTransactions(accountId, ids);
      setDrawerTxs(txs);
    });
  }

  const nodeMap: Record<string, React.ReactNode> = {
    "kpi-month-total": (
      <KpiSparklineCard
        title={m.dashboards.kpi.monthTotal}
        value={formatCentsToBrl(totalBigInt)}
        color={totalBigInt >= 0n ? "success" : "error"}
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
    "kpi-top-category": topCategory ? (
      <KpiSparklineCard
        title={m.dashboards.kpi.topCategory}
        value={formatCentsToBrl(BigInt(topCategory.totalCents))}
        subtitle={topCategory.name}
        color="info"
        icon={CategoryIcon}
      />
    ) : null,
    "kpi-pending":
      pendingCount > 0 ? (
        <KpiSparklineCard
          title={m.dashboards.kpi.pendingCount}
          value={String(pendingCount)}
          color="warning"
          icon={AccessTimeIcon}
        />
      ) : null,
    budgets: (
      <WidgetContainer
        title={m.budgets.title}
        subtitle={`${budgets.length} ${budgets.length === 1 ? "meta" : "metas"}`}
        icon={WIDGET_ICONS["budgets"]}
        collapsible
        secondary={
          <Tooltip title={m.budgets.createButton}>
            <IconButton size="small" onClick={() => setBudgetFormOpen(true)}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        }
      >
        <BudgetWidgetContent budgets={budgets} onAddClick={() => setBudgetFormOpen(true)} />
      </WidgetContainer>
    ),
    "daily-heatmap":
      subtractSections.length > 0 ? (
        <WidgetContainer
          title={m.dashboards.sections.calendarHeatmap}
          subtitle="Intensidade = total gasto naquele dia (seções de saída)"
          icon={WIDGET_ICONS["daily-heatmap"]}
        >
          <DailyHeatmap
            year={year}
            month={month}
            dailyTotals={dailyTotals}
            onDayClick={(ids, day) => openDrawer(ids, `Gastos do dia ${day}/${month}/${year}`)}
          />
        </WidgetContainer>
      ) : null,
    "category-treemap": (
      <WidgetContainer
        title={m.dashboards.sections.categoryTreemap}
        icon={WIDGET_ICONS["category-treemap"]}
      >
        <CategoryTreemap
          categories={treemapData}
          onDrillDown={(ids, label) => openDrawer(ids, label)}
        />
      </WidgetContainer>
    ),
    "money-flow":
      sankeyData.nodes.length > 0 ? (
        <WidgetContainer
          title={m.dashboards.sections.moneyFlow}
          subtitle="Fluxo: entradas → total disponível → categorias de gastos"
          icon={WIDGET_ICONS["money-flow"]}
        >
          <SankeyChart data={sankeyData} />
        </WidgetContainer>
      ) : null,
    "section-breakdown": (
      <WidgetContainer
        title={m.dashboards.sections.sectionBreakdown}
        icon={WIDGET_ICONS["section-breakdown"]}
      >
        <SectionPieChart sections={sections} sectionTotals={sectionTotals} />
      </WidgetContainer>
    ),
    "category-breakdown": (
      <WidgetContainer
        title={m.dashboards.sections.categoryBreakdown}
        icon={WIDGET_ICONS["category-breakdown"]}
      >
        <CategoryPieChart categories={topCategories} />
      </WidgetContainer>
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
      <WidgetContainer
        title={m.dashboards.sections.biggestTransactions}
        icon={WIDGET_ICONS["top-transactions"]}
      >
        <TopTransactionTable transactions={topTransactions} />
      </WidgetContainer>
    ),
  };

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

      <DashboardWidgetRenderer active={activeWidgets} nodeMap={nodeMap} />

      <DrillDownDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerTitle}
        transactions={drawerTxs}
        loading={drawerLoading}
      />

      <BudgetFormDialog
        open={budgetFormOpen}
        onClose={() => setBudgetFormOpen(false)}
        accountId={accountId}
        formOptions={budgetFormOptions}
        onSuccess={() => setBudgetFormOpen(false)}
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
