"use client";

import dynamic from "next/dynamic";
import React, { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import BarChartIcon from "@mui/icons-material/BarChart";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import type {
  SectionMeta,
  CategorySum,
  TopTransaction,
  MonthSparklineResult,
  ComparisonResult,
  DayTotal,
  TreemapCategory,
  SankeyData,
  DrillDownTransaction,
} from "@/lib/queries/dashboards";
import { getTransactionsByIds } from "@/lib/queries/dashboards";
import type { MemberBreakdownRow } from "@/lib/queries/member-analytics";

import { KpiSparklineCard } from "./KpiSparklineCard";
import { MemberBreakdownChart, MemberBreakdownView } from "./MemberBreakdownChart";
import { DailyHeatmap } from "./DailyHeatmap";
import { CategoryTreemap } from "./CategoryTreemap";
import { DrillDownDrawer } from "./DrillDownDrawer";
import { ComparisonToggle, type CompareMode } from "./ComparisonToggle";
import { SectionPieChart } from "./SectionPieChart";
import { CategoryPieChart } from "./CategoryPieChart";
import { PinnedAnalysesSection } from "./PinnedAnalysesSection";
import { InsightsCard } from "./InsightsCard";
import { DashboardWidgetRenderer } from "./DashboardWidgetRenderer";
import type { Insight } from "@/server/services/insights-service";
import type { PinnedAnalysisData } from "@/lib/queries/sandbox";
import { BudgetProgressBar } from "@/components/budgets/BudgetProgressBar";
import { BudgetFormDialog } from "@/components/budgets/BudgetFormDialog";
import type { BudgetProgress, BudgetFormOptions } from "@/lib/queries/budgets";
import type { WidgetDef } from "@/components/dashboards/widget-registry";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SavingsIcon from "@mui/icons-material/Savings";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CategoryIcon from "@mui/icons-material/Category";
import AddIcon from "@mui/icons-material/Add";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ScienceIcon from "@mui/icons-material/Science";
import Tooltip from "@mui/material/Tooltip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/widget-icons";
import Button from "@mui/material/Button";
import { AppLink } from "../ui/AppLink";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";

// @nivo/sankey loaded client-only (no SSR — uses D3 hooks)
const SankeyChart = dynamic(() => import("./SankeyChart").then((m) => m.SankeyChart), {
  ssr: false,
  loading: () => (
    <Box sx={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Typography variant="caption" color="text.secondary">
        Carregando fluxo...
      </Typography>
    </Box>
  ),
});

type TxRow = {
  id: string;
  description: string | null;
  occurredOn: string;
  amountCents: string;
  sectionName: string;
  sectionCountType: string;
};

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
  pinnedAnalyses: PinnedAnalysisData[];
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
  pinnedAnalyses,
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
        {budgets.length > 0 ? (
          <Stack spacing={1.5}>
            {budgets.map((b) => (
              <BudgetProgressBar
                key={b.id}
                label={b.label}
                amountCents={b.amountCents}
                spentCents={b.spentCents}
                percent={b.percent}
                alertThresholdPercent={b.alertThresholdPercent}
              />
            ))}
          </Stack>
        ) : (
          <Stack direction="column" alignItems="center" gap={1.5} sx={{ py: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Defina metas de orçamento para acompanhar no dashboard.
            </Typography>
            <Button
              size="small"
              variant="text"
              startIcon={<AddIcon />}
              onClick={() => setBudgetFormOpen(true)}
              sx={{ color: "text.secondary", fontSize: "0.75rem" }}
            >
              {m.budgets.createButton}
            </Button>
          </Stack>
        )}
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
        {topCategories.length > 0 ? (
          <CategoryPieChart categories={topCategories} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Sem categorias neste mês.
          </Typography>
        )}
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
    insights: (
      <WidgetContainer title={m.dashboards.insights.cardTitle} icon={WIDGET_ICONS["insights"]}>
        <InsightsCard insights={insights} />
      </WidgetContainer>
    ),
    "member-breakdown": memberBreakdown.some((r) => BigInt(r.totalCents) > 0n) ? (
      <WidgetContainer
        title={m.dashboards.sections.memberBreakdown}
        icon={WIDGET_ICONS["member-breakdown"]}
        secondary={
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, v: MemberBreakdownView | null) => v && setView(v)}
          >
            <ToggleButton value="donut" aria-label={m.dashboards.members.viewDonut}>
              <Tooltip title={m.dashboards.members.viewDonut}>
                <DonutLargeIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="bars" aria-label={m.dashboards.members.viewBars}>
              <Tooltip title={m.dashboards.members.viewBars}>
                <BarChartIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        }
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

// Determina a cor do valor com base no impacto financeiro real da transação.
// Para "subtract" o sinal é invertido (R$ 500 num cartão = -500 no total).
// Para "neutral" usa o sinal próprio do valor.
// Para "ignore" sem cor (a seção não conta no total).
function getAmountColor(amountCents: bigint, countType: string): string {
  if (countType === "ignore") return "text.disabled";
  const impact = countType === "subtract" ? -amountCents : amountCents;
  if (impact > 0n) return "success.main";
  if (impact < 0n) return "danger.main";
  return "text.tertiary";
}

function TopTransactionTable({ transactions }: { transactions: TxRow[] }) {
  if (transactions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nenhuma transação.
      </Typography>
    );
  }

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontSize: 11, whiteSpace: "nowrap" }}>Data</TableCell>
            <TableCell sx={{ fontSize: 11 }}>Descrição</TableCell>
            <TableCell sx={{ fontSize: 11 }}>Seção</TableCell>
            <TableCell sx={{ fontSize: 11 }} align="right">
              Valor
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx) => {
            const cents = BigInt(tx.amountCents);
            const amountColor = getAmountColor(cents, tx.sectionCountType);
            return (
              <TableRow key={tx.id} hover>
                <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {tx.occurredOn.slice(8, 10)}/{tx.occurredOn.slice(5, 7)}
                </TableCell>
                <TableCell
                  sx={{
                    fontSize: 12,
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tx.description ?? (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ color: "text.disabled", fontStyle: "italic" }}
                    >
                      Sem descrição
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ fontSize: 11 }}>
                  <StatusBadge variant="neutral">{tx.sectionName}</StatusBadge>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                      color: amountColor,
                    }}
                  >
                    {formatCentsToBrl(cents)}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
