"use client";

import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dynamic from "next/dynamic";

import { ChartSkeleton } from "@/components/dashboards/charts/ChartSkeleton";
import { DialogShell } from "@/components/ui/DialogShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { BudgetConfigWithHistory } from "@/server/queries/budgets";

import { getBudgetLabel } from "./budget-label";
import { BUDGET_STATUS_LABEL, BUDGET_STATUS_VARIANT } from "./budget-status";
import { DimensionChips } from "./DimensionChips";

// Lazy — mantém recharts fora do bundle inicial (espelha GoalDetailDrawer.tsx/
// NetWorthManager.tsx). O histórico em barras só existe dentro deste dialog.
const BudgetHistoryChart = dynamic(
  () => import("./BudgetHistoryChart").then((mod) => mod.BudgetHistoryChart),
  { ssr: false, loading: () => <ChartSkeleton height={220} /> },
);

type Props = {
  open: boolean;
  onClose: () => void;
  budget: BudgetConfigWithHistory;
};

/**
 * Dialog de detalhe de UM orçamento (spec 47 §5.9 fix wave) — espelha
 * `GoalDetailDrawer`: `DialogShell` (nunca `<Dialog>` cru, CLAUDE.md §5.11) com o
 * histórico mensal em BARRAS (`BudgetHistoryChart`, via `next/dynamic` porque
 * recharts é browser-only), um resumo compacto (contagem de meses por status +
 * média de gasto + status do último mês) e as dimensões do orçamento em chips.
 *
 * Todo o dado já vem pronto em `BudgetConfigWithHistory` (`getBudgetsConfigWithHistory`,
 * spec 25) — o resumo abaixo só DERIVA estatísticas simples de `budget.history` no
 * client (contagem/média), sem novo fetch nem novo cálculo de servidor.
 */
export function BudgetDetailDialog({ open, onClose, budget }: Props) {
  const label = budget.name || getBudgetLabel(budget);
  const history = budget.history;
  // `history` vem ordenado do mais antigo para o mais recente (getBudgetsConfigWithHistory).
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;

  const counts = history.reduce(
    (acc, entry) => {
      acc[entry.status] += 1;
      return acc;
    },
    { ok: 0, alert: 0, exceeded: 0 },
  );

  // Média simples de gasto mensal — só para o resumo do dialog; nenhuma regra de
  // negócio nova (o gasto de cada mês já vem calculado por `calcSpent`).
  const averageSpentCents =
    history.length > 0
      ? history.reduce((sum, entry) => sum + BigInt(entry.spentCents), 0n) / BigInt(history.length)
      : 0n;

  return (
    <DialogShell open={open} onClose={onClose} maxWidth="md" title={label}>
      <Stack spacing={layout.card}>
        <BudgetHistoryChart history={history} amountCents={budget.amountCents} height={220} />

        <Divider />

        <Stack spacing={layout.stack}>
          <Typography variant="overline" sx={{ color: "text.tertiary" }}>
            {m.budgets.detail.summaryTitle}
          </Typography>
          {/* Contagem por status COLORIDA (spec 47 §5.9 fix wave): reusa o mesmo
              BUDGET_STATUS_VARIANT do badge do último mês — cor é informação
              (CLAUDE.md §5.11) e serve de chave de cor pro gráfico de barras acima
              (verde=controle / amarelo=atenção / vermelho=ultrapassado). */}
          <Stack direction="row" flexWrap="wrap" gap={layout.cluster}>
            <StatusBadge variant={BUDGET_STATUS_VARIANT.ok}>
              {m.budgets.hero.okCount(counts.ok)}
            </StatusBadge>
            <StatusBadge variant={BUDGET_STATUS_VARIANT.alert}>
              {m.budgets.hero.attentionCount(counts.alert)}
            </StatusBadge>
            <StatusBadge variant={BUDGET_STATUS_VARIANT.exceeded}>
              {m.budgets.hero.exceededCount(counts.exceeded)}
            </StatusBadge>
          </Stack>
          <Stack direction="row" alignItems="center" gap={layout.inline} flexWrap="wrap">
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {m.budgets.detail.averageSpent}:
            </Typography>
            <Typography variant="mono" sx={{ fontWeight: 600, color: "text.primary" }}>
              {formatCentsToBrl(averageSpentCents)}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" gap={layout.inline}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {m.budgets.detail.lastMonth}:
            </Typography>
            {lastEntry ? (
              <StatusBadge variant={BUDGET_STATUS_VARIANT[lastEntry.status]}>
                {BUDGET_STATUS_LABEL[lastEntry.status]}
              </StatusBadge>
            ) : (
              <StatusBadge variant="neutral">{m.budgets.history.noData}</StatusBadge>
            )}
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={layout.stack}>
          <Typography variant="overline" sx={{ color: "text.tertiary" }}>
            {m.budgets.detail.dimensionsTitle}
          </Typography>
          <DimensionChips budget={budget} />
        </Stack>
      </Stack>
    </DialogShell>
  );
}
