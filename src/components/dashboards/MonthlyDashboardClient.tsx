"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

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

import { KpiSparklineCard } from "./KpiSparklineCard";
import { DailyHeatmap } from "./DailyHeatmap";
import { CategoryTreemap } from "./CategoryTreemap";
import { DrillDownDrawer } from "./DrillDownDrawer";
import { ComparisonToggle, type CompareMode } from "./ComparisonToggle";
import { SectionPieChart } from "./SectionPieChart";
import { CategoryPieChart } from "./CategoryPieChart";
import { PinnedAnalysesSection } from "./PinnedAnalysesSection";
import type { PinnedAnalysisData } from "@/lib/queries/sandbox";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SavingsIcon from "@mui/icons-material/Savings";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CategoryIcon from "@mui/icons-material/Category";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { StatusBadge } from "@/components/ui/StatusBadge";

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

  function openDrawer(ids: string[], title: string) {
    setDrawerTitle(title);
    setDrawerOpen(true);
    startDrawerTransition(async () => {
      // getTransactionsByIds is a server query — call a server action wrapper
      // For now, show what we have; full lazy fetch via action if needed
      const txs = await fetchDrawerTransactions(accountId, ids);
      setDrawerTxs(txs);
    });
  }

  return (
    <Box>
      {/* Comparison toggle */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <ComparisonToggle
          value={compareMode}
          onChange={setCompareMode}
          hasPrevYear={hasPrevYear}
          hasAvg3m={hasAvg3m}
        />
      </Box>

      {/* KPI row */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(6, 1fr)" },
          gap: 1.5,
          mb: 3,
        }}
      >
        <KpiSparklineCard
          title={m.dashboards.kpi.monthTotal}
          value={formatCentsToBrl(totalBigInt)}
          color={totalBigInt >= 0n ? "success" : "error"}
          sparkline={sparklineData.totalSparkline}
          currentCents={monthTotal}
          prevCents={compValues.total}
          deltaMode={compareMode}
        />
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
        <KpiSparklineCard
          title={m.dashboards.kpi.savingsRate}
          value={`${savingsRate}%`}
          subtitle={savingsRate < 0 ? "Deficit" : savingsRate < 10 ? "Atenção" : "Bom"}
          color={savingsRate >= 20 ? "success" : savingsRate >= 0 ? "warning" : "error"}
          icon={SavingsIcon}
        />
        {topCategory && (
          <KpiSparklineCard
            title={m.dashboards.kpi.topCategory}
            value={formatCentsToBrl(BigInt(topCategory.totalCents))}
            subtitle={topCategory.name}
            color="info"
            icon={CategoryIcon}
          />
        )}
        {pendingCount > 0 && (
          <KpiSparklineCard
            title={m.dashboards.kpi.pendingCount}
            value={String(pendingCount)}
            color="warning"
            icon={AccessTimeIcon}
          />
        )}
      </Box>

      {/* Row 1: Calendar Heatmap + Category Treemap */}
      <Box
        sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3, mb: 3 }}
      >
        {subtractSections.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              {m.dashboards.sections.calendarHeatmap}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
              Intensidade = total gasto naquele dia (seções de saída)
            </Typography>
            <DailyHeatmap
              year={year}
              month={month}
              dailyTotals={dailyTotals}
              onDayClick={(ids, day) => openDrawer(ids, `Gastos do dia ${day}/${month}/${year}`)}
            />
          </Paper>
        )}

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            {m.dashboards.sections.categoryTreemap}
          </Typography>
          <CategoryTreemap
            categories={treemapData}
            onDrillDown={(ids, label) => openDrawer(ids, label)}
          />
        </Paper>
      </Box>

      {/* Row 2: Sankey */}
      {sankeyData.nodes.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            {m.dashboards.sections.moneyFlow}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            Fluxo: entradas → total disponível → categorias de gastos
          </Typography>
          <SankeyChart data={sankeyData} />
        </Paper>
      )}

      {/* Row 3: Existing pie charts */}
      <Box
        sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3, mb: 3 }}
      >
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            {m.dashboards.sections.sectionBreakdown}
          </Typography>
          <SectionPieChart sections={sections} sectionTotals={sectionTotals} />
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            {m.dashboards.sections.categoryBreakdown}
          </Typography>
          {topCategories.length > 0 ? (
            <CategoryPieChart categories={topCategories} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Sem categorias neste mês.
            </Typography>
          )}
        </Paper>
      </Box>

      {/* Row 4: Pinned analyses */}
      <Box sx={{ mb: 3 }}>
        <PinnedAnalysesSection accountId={accountId} pinnedAnalyses={pinnedAnalyses} />
      </Box>

      {/* Row 5: Top transactions */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          {m.dashboards.sections.biggestTransactions}
        </Typography>
        <TopTransactionTable transactions={topTransactions} />
      </Paper>

      {/* DrillDown Drawer */}
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
            <TableCell sx={{ fontSize: 11 }} align="right">Valor</TableCell>
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
                    <Typography component="span" variant="caption" sx={{ color: "text.disabled", fontStyle: "italic" }}>
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
