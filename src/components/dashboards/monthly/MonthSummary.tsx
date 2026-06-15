import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import DashboardIcon from "@mui/icons-material/Dashboard";

import { AppLink } from "@/components/ui/AppLink";
import { KpiSparklineCard } from "@/components/dashboards/kpi/KpiSparklineCard";
import { BudgetWidgetContent } from "@/components/budgets/BudgetWidgetContent";
import { SectionCards } from "../panels/SectionCards";
import { ActivityLists } from "../panels/ActivityLists";
import { DashboardGrid } from "@/components/dashboards/_core/DashboardGrid";
import { InsightsCard } from "@/components/dashboards/panels/InsightsCard";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import type { BudgetProgress } from "@/lib/queries/budgets";
import type { Insight } from "@/server/services/insights-service";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { ReactNode } from "react";

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
  insights: Insight[];
  widgets: StoredWidget[];
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
  insights,
  widgets,
}: Props) {
  const totalBigInt = BigInt(monthTotal);

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

  // Seções sem atividade — delegado ao SectionCards
  const dashboardHref = `/${accountId}/dashboards/monthly/${monthId}`;

  const nodeByWidgetId: Record<string, ReactNode> = {
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
    budgets:
      summaryBudgets && summaryBudgets.length > 0 ? (
        <WidgetContainer title={m.budgets.title} icon={WIDGET_ICONS["budgets"]}>
          <BudgetWidgetContent budgets={summaryBudgets} compact />
        </WidgetContainer>
      ) : null,
    "section-cards": (
      <WidgetContainer
        title={m.dashboards.widgets.month_summary["section-cards"]}
        icon={WIDGET_ICONS["section-cards"]}
      >
        <SectionCards
          sections={sections}
          sectionTotals={sectionTotals}
          prevSectionTotals={prevSectionTotals}
          accountId={accountId}
          monthId={monthId}
          tables={tables}
        />
      </WidgetContainer>
    ),
    "activity-lists": (
      <WidgetContainer
        title={m.dashboards.widgets.month_summary["activity-lists"]}
        icon={WIDGET_ICONS["activity-lists"]}
      >
        <ActivityLists
          accountId={accountId}
          monthId={monthId}
          pendingTransactions={pendingTransactions}
          favoriteTransactions={favoriteTransactions}
          recentTransactions={recentTransactions}
        />
      </WidgetContainer>
    ),
    insights: (
      <WidgetContainer title={m.dashboards.insights.cardTitle} icon={WIDGET_ICONS["insights"]}>
        <InsightsCard insights={insights} />
      </WidgetContainer>
    ),
  };

  // nodeMap por instanceId: cada instância resolve seu nó pelo widgetId.
  const nodeMap: Record<string, ReactNode> = {};
  for (const w of widgets) {
    nodeMap[w.instanceId] = nodeByWidgetId[w.widgetId] ?? null;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* ── Total + link para dashboard — header fixo ── */}
      <Box
        sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2.5 }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ color: "text.tertiary", fontSize: "0.65rem", lineHeight: 1.4 }}
          >
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
        <Typography
          variant="caption"
          color="text.secondary"
          textAlign="center"
          display="block"
          mt={3}
        >
          Configure seções em Configurações → Seções para organizar seus dados.
        </Typography>
      )}

      <DashboardGrid widgets={widgets} nodeMap={nodeMap} cols={6} />
    </Box>
  );
}
