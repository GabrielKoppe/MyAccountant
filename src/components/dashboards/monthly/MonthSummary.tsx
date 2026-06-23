import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import DashboardIcon from "@mui/icons-material/Dashboard";

import { AppLink } from "@/components/ui/AppLink";
import { KpiCard } from "@/components/dashboards/charts/lazy";
import { BudgetsWidget } from "@/components/budgets/BudgetsWidget";
import { SectionCards } from "../panels/SectionCards";
import {
  PendingTransactionsWidget,
  FavoriteTransactionsWidget,
  RecentTransactionsWidget,
  type ActivityTx,
} from "../panels/ActivityWidget";
import { DashboardGrid } from "@/components/dashboards/_core/DashboardGrid";
import { InsightsCard } from "@/components/dashboards/panels/InsightsCard";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import type { BudgetProgress } from "@/server/queries/budgets";
import type { Insight } from "@/server/services/insights-service";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import {
  kpiCustomConfigSchema,
  filteredTransactionsConfigSchema,
} from "@/lib/schemas/widget-config";
import type { KpiCustomResult } from "@/server/queries/kpi-custom";
import { KpiCustomWidget } from "@/components/dashboards/kpi/KpiCustomWidget";
import {
  FilteredTransactionsWidget,
  type FilterOption,
} from "@/components/dashboards/panels/FilteredTransactionsWidget";
import type { TxRow } from "@/components/dashboards/panels/TopTransactionTable";
import type { ReactNode } from "react";
import { getRenderMode } from "@/components/dashboards/_core/widget-registry";
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

type QuickTx = ActivityTx;

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
  kpiCustomData: Record<string, KpiCustomResult>;
  filteredTransactionsData: Record<string, TxRow[]>;
  // Opções para resolver IDs de filtros em nomes legíveis no subtitle do filtered-transactions
  filterOptions?: {
    categories?: FilterOption[];
    institutions?: FilterOption[];
    members?: FilterOption[];
  };
  // Spec 38
  transactionCount?: number;
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
  kpiCustomData,
  filteredTransactionsData,
  filterOptions,
  // Spec 38
  transactionCount,
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

  const sectionCardsRenderMode = getRenderMode(widgets, "month_summary", "section-cards") as
    | "default"
    | "small"
    | "compact";

  const kpiRm = (id: string) => getRenderMode(widgets, "month_summary", id);

  const nodeByWidgetId: Record<string, ReactNode> = {
    "kpi-income": (
      <KpiCard
        title="Receitas"
        value={formatCentsToBrl(incomeTotal)}
        color="success"
        currentCents={incomeTotal.toString()}
        prevCents={prevSectionTotals ? prevIncomeTotal.toString() : null}
        deltaMode={prevSectionTotals ? "prevMonth" : "none"}
        renderMode={kpiRm("kpi-income")}
      />
    ),
    "kpi-expenses": (
      <KpiCard
        title="Despesas"
        value={formatCentsToBrl(expenseTotal)}
        color="error"
        deltaMode="none"
        renderMode={kpiRm("kpi-expenses")}
      />
    ),
    "kpi-balance": (
      <KpiCard
        title="Saldo"
        value={formatCentsToBrl(totalBigInt)}
        color={totalBigInt >= 0n ? "success" : "error"}
        currentCents={monthTotal}
        prevCents={prevSectionTotals ? prevMonthTotal.toString() : null}
        deltaMode={prevSectionTotals ? "prevMonth" : "none"}
        renderMode={kpiRm("kpi-balance")}
      />
    ),
    budgets: (
      <BudgetsWidget
        budgets={summaryBudgets!}
        accountId={accountId}
        monthId={monthId}
        renderMode={
          getRenderMode(widgets, "month_summary", "budgets") as "compact" | "default" | "full"
        }
      />
    ),
    "section-cards": (
      <SectionCards
        sections={sections}
        sectionTotals={sectionTotals}
        prevSectionTotals={prevSectionTotals}
        accountId={accountId}
        monthId={monthId}
        tables={tables}
        renderMode={sectionCardsRenderMode}
      />
    ),
    "pending-transactions": (
      <PendingTransactionsWidget
        transactions={pendingTransactions}
        accountId={accountId}
        monthId={monthId}
        renderMode={
          getRenderMode(widgets, "month_summary", "pending-transactions") as
            | "compact"
            | "default"
            | "full"
        }
      />
    ),
    "favorite-transactions": (
      <FavoriteTransactionsWidget
        transactions={favoriteTransactions}
        accountId={accountId}
        monthId={monthId}
        renderMode={
          getRenderMode(widgets, "month_summary", "favorite-transactions") as
            | "compact"
            | "default"
            | "full"
        }
      />
    ),
    "recent-transactions": (
      <RecentTransactionsWidget
        transactions={recentTransactions}
        accountId={accountId}
        monthId={monthId}
        renderMode={
          getRenderMode(widgets, "month_summary", "recent-transactions") as
            | "compact"
            | "default"
            | "full"
        }
      />
    ),
    insights: (
      <InsightsCard
        insights={insights}
        renderMode={
          getRenderMode(widgets, "month_summary", "insights") as "compact" | "default" | "full"
        }
      />
    ),
    // ─── Spec 38 ────────────────────────────────────────────────────────────
    "kpi-pending": (
      <KpiCard
        title={m.dashboards.kpi.pendingCount}
        value={String(pendingTransactions.length)}
        color={pendingTransactions.length > 0 ? "warning" : "default"}
        renderMode={kpiRm("kpi-pending")}
      />
    ),
    "kpi-transaction-count": (() => {
      const expCount = tables.reduce((s, t) => {
        const sec = sections.find((sec) => sec.id === t.sectionId);
        return sec?.countType === "subtract" ? s + t.transactionCount : s;
      }, 0);
      const incCount = tables.reduce((s, t) => {
        const sec = sections.find((sec) => sec.id === t.sectionId);
        return sec?.countType === "add" ? s + t.transactionCount : s;
      }, 0);
      return (
        <KpiCard
          title={m.dashboards.kpi.transactionCount}
          value={String(transactionCount ?? 0)}
          color="info"
          breakdown={[
            { label: "Saídas", value: String(expCount), dotColor: "error.main" },
            { label: "Entradas", value: String(incCount), dotColor: "success.main" },
          ]}
          renderMode={kpiRm("kpi-transaction-count")}
        />
      );
    })(),
  };

  // nodeMap por instanceId: singletons pelo widgetId; instâncias kpi-custom e
  // filtered-transactions têm config + dados próprios por instância.
  const nodeMap: Record<string, ReactNode> = {};
  for (const w of widgets) {
    if (w.widgetId === "kpi-custom") {
      const parsed = kpiCustomConfigSchema.safeParse(w.config);
      const config = parsed.success ? parsed.data : kpiCustomConfigSchema.parse({});
      const data = kpiCustomData[w.instanceId];
      nodeMap[w.instanceId] = data ? <KpiCustomWidget config={config} data={data} /> : null;
    } else if (w.widgetId === "filtered-transactions") {
      const rows = filteredTransactionsData[w.instanceId] ?? [];
      const ftConfig = filteredTransactionsConfigSchema.safeParse(w.config);
      nodeMap[w.instanceId] = (
        <FilteredTransactionsWidget
          transactions={rows}
          config={ftConfig.success ? ftConfig.data : undefined}
          options={filterOptions}
        />
      );
    } else {
      nodeMap[w.instanceId] = nodeByWidgetId[w.widgetId] ?? null;
    }
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
