import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DashboardIcon from "@mui/icons-material/Dashboard";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import StarIcon from "@mui/icons-material/Star";
import ScheduleIcon from "@mui/icons-material/Schedule";

import { AppLink } from "@/components/ui/AppLink";
import { KpiSparklineCard } from "@/components/dashboards/KpiSparklineCard";
import { BudgetProgressBar } from "@/components/budgets/BudgetProgressBar";
import { DashboardWidgetRenderer } from "@/components/dashboards/DashboardWidgetRenderer";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import type { BudgetProgress } from "@/lib/queries/budgets";
import type { WidgetDef } from "@/components/dashboards/widget-registry";
import { TransactionQuickList } from "./TransactionQuickList";

type SectionItem = {
  id: string;
  name: string;
  countType: SectionCountType;
  isActive: boolean;
};

type FinanceTableItem = {
  id: string;
  name: string;
  sectionId: string;
  countInMonth: boolean;
  transactionCount: number;
};

type QuickTx = {
  id: string;
  description: string | null;
  amountCents: string;
  sectionId: string;
};

type Props = {
  sections: SectionItem[];
  sectionTotals: Record<string, string>;
  monthTotal: string;
  tables: FinanceTableItem[];
  accountId: string;
  monthId: string;
  pendingTransactions: QuickTx[];
  favoriteTransactions: QuickTx[];
  recentTransactions: QuickTx[];
  prevSectionTotals?: Record<string, string>;
  summaryBudgets?: BudgetProgress[];
  activeWidgets: WidgetDef[];
};

const COUNT_TYPE_COLORS: Record<SectionCountType, "success" | "error" | "default" | "warning"> = {
  add: "success",
  subtract: "error",
  ignore: "default",
  neutral: "warning",
};

export function MonthSummary({
  sections,
  sectionTotals,
  monthTotal,
  tables,
  accountId,
  monthId,
  pendingTransactions,
  favoriteTransactions,
  recentTransactions,
  prevSectionTotals,
  summaryBudgets,
  activeWidgets,
}: Props) {
  const totalBigInt = BigInt(monthTotal);
  const visibleSections = sections.filter((s) => s.countType !== "ignore");

  // Receitas, despesas e totais anteriores
  let incomeTotal = 0n;
  let expenseTotal = 0n;
  let prevIncomeTotal = 0n;
  let prevMonthTotal = 0n;

  for (const section of sections) {
    const cur = BigInt(sectionTotals[section.id] ?? "0");
    const abs = cur < 0n ? -cur : cur;
    if (section.countType === "add") incomeTotal += abs;
    else if (section.countType === "subtract") expenseTotal += abs;

    if (prevSectionTotals) {
      const prev = BigInt(prevSectionTotals[section.id] ?? "0");
      const prevAbs = prev < 0n ? -prev : prev;
      if (section.countType === "add") prevIncomeTotal += prevAbs;
      if (section.countType === "add") prevMonthTotal += prev;
      else if (section.countType === "subtract") prevMonthTotal -= prev;
      else if (section.countType === "neutral") prevMonthTotal += prev;
    }
  }

  // Seções sem atividade
  const sectionsWithoutActivity = visibleSections.filter((section) => {
    const sectionTables = tables.filter((t) => t.sectionId === section.id);
    return sectionTables.length === 0 || sectionTables.every((t) => t.transactionCount === 0);
  });

  const dashboardHref = `/${accountId}/dashboards/monthly/${monthId}`;

  const sectionCardsNode = (
    <>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
        {visibleSections.map((section) => {
          const curTotal = BigInt(sectionTotals[section.id] ?? "0");
          const prevTotal = prevSectionTotals ? BigInt(prevSectionTotals[section.id] ?? "0") : null;
          const delta =
            prevTotal !== null && prevTotal !== 0n
              ? ((Number(curTotal) - Number(prevTotal)) / Math.abs(Number(prevTotal))) * 100
              : null;
          return (
            <Box
              key={section.id}
              component={AppLink}
              href={`/${accountId}/months/${monthId}?tab=${section.id}`}
              sx={{
                textDecoration: "none",
                color: "inherit",
                px: 1.5,
                py: 1,
                borderRadius: 1,
                border: 1,
                borderColor: "border.subtle",
                minWidth: 110,
                flex: "1 1 110px",
                maxWidth: 200,
                transition: "border-color 120ms",
                "&:hover": { borderColor: "border.default" },
              }}
            >
              <Stack spacing={0.25}>
                <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: "0.7rem" }}>
                    {section.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={m.settings.sections.countTypes[section.countType]}
                    color={COUNT_TYPE_COLORS[section.countType]}
                    sx={{ height: 14, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.75 } }}
                  />
                </Stack>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}
                >
                  {formatCentsToBrl(curTotal)}
                </Typography>
                {delta !== null && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.65rem",
                      color: delta === 0 ? "text.disabled" : delta > 0 ? "success.main" : "danger.main",
                    }}
                  >
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                  </Typography>
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>
      {sectionsWithoutActivity.length > 0 && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: "text.tertiary" }}>
          <InfoOutlinedIcon sx={{ fontSize: 12 }} />
          <Typography variant="caption" sx={{ fontSize: "0.7rem" }}>
            {sectionsWithoutActivity.length === 1
              ? "1 seção sem transações este mês"
              : `${sectionsWithoutActivity.length} seções sem transações este mês`}
          </Typography>
        </Stack>
      )}
    </>
  );

  const activityListsNode = (
    <Grid container spacing={1.5}>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
            <PendingActionsIcon sx={{ fontSize: 14, color: "warning.main" }} />
            <Typography variant="caption" fontWeight={600}>Pendentes</Typography>
            {pendingTransactions.length > 0 && (
              <Chip label={pendingTransactions.length} size="small" color="warning"
                sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.75 } }} />
            )}
          </Stack>
          <TransactionQuickList accountId={accountId} monthId={monthId} transactions={pendingTransactions} mode="pending" />
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
            <StarIcon sx={{ fontSize: 14, color: "warning.main" }} />
            <Typography variant="caption" fontWeight={600}>Favoritas</Typography>
            {favoriteTransactions.length > 0 && (
              <Chip label={favoriteTransactions.length} size="small" color="warning"
                sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.75 } }} />
            )}
          </Stack>
          <TransactionQuickList accountId={accountId} monthId={monthId} transactions={favoriteTransactions} mode="favorite" />
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
            <ScheduleIcon sx={{ fontSize: 14, color: "text.tertiary" }} />
            <Typography variant="caption" fontWeight={600}>Últimas adicionadas</Typography>
          </Stack>
          <TransactionQuickList accountId={accountId} monthId={monthId} transactions={recentTransactions} mode="recent" />
        </Paper>
      </Grid>
    </Grid>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* ── Total + link para dashboard — header fixo ── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2.5 }}>
        <Box>
          <Typography variant="overline" sx={{ color: "text.tertiary", fontSize: "0.65rem", lineHeight: 1.4 }}>
            {m.months.monthTotal}
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
              fontWeight: 500,
              color: totalBigInt >= 0n ? "success.main" : "danger.main",
              lineHeight: 1.2,
            }}
          >
            {formatCentsToBrl(totalBigInt)}
          </Typography>
        </Box>
        <Button
          variant="text"
          size="small"
          component={AppLink}
          href={dashboardHref}
          startIcon={<DashboardIcon sx={{ fontSize: "14px !important" }} />}
          sx={{ color: "text.tertiary", fontSize: "0.75rem", mt: 0.5 }}
        >
          Ver Dashboard
        </Button>
      </Box>

      {sections.length === 0 && (
        <Typography variant="caption" color="text.secondary" textAlign="center" display="block" mt={3}>
          Configure seções em Configurações → Seções para organizar seus dados.
        </Typography>
      )}

      <DashboardWidgetRenderer
        active={activeWidgets}
        nodeMap={{
          "kpi-income": (
            <KpiSparklineCard
              title="Receitas"
              value={formatCentsToBrl(incomeTotal)}
              color="success"
              currentCents={incomeTotal.toString()}
              prevCents={prevSectionTotals ? prevIncomeTotal.toString() : null}
              deltaMode={prevSectionTotals ? "prevMonth" : "none"}
            />
          ),
          "kpi-expenses": (
            <KpiSparklineCard
              title="Despesas"
              value={formatCentsToBrl(expenseTotal)}
              color="error"
              deltaMode="none"
            />
          ),
          "kpi-balance": (
            <KpiSparklineCard
              title="Saldo"
              value={formatCentsToBrl(totalBigInt)}
              color={totalBigInt >= 0n ? "success" : "error"}
              currentCents={monthTotal}
              prevCents={prevSectionTotals ? prevMonthTotal.toString() : null}
              deltaMode={prevSectionTotals ? "prevMonth" : "none"}
            />
          ),
          budgets: summaryBudgets && summaryBudgets.length > 0 ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 1.5 }}>
                {m.budgets.title}
              </Typography>
              <Stack spacing={1.25}>
                {summaryBudgets.map((b) => (
                  <BudgetProgressBar
                    key={b.id}
                    label={b.label}
                    amountCents={b.amountCents}
                    spentCents={b.spentCents}
                    percent={b.percent}
                    alertThresholdPercent={b.alertThresholdPercent}
                    compact
                  />
                ))}
              </Stack>
            </Paper>
          ) : null,
          "section-cards": sectionCardsNode,
          "activity-lists": activityListsNode,
        }}
      />
    </Box>
  );
}
