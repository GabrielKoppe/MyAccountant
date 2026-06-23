"use client";

// Spec 38 FEAT-01 — KPI de saúde das metas.
// Usa KpiCard com prop gauge para manter o padrão visual do projeto.
// Cor semântica: verde < 70%, amarelo 70–90%, vermelho > 90%.

import FlagIcon from "@mui/icons-material/Flag";

import { KpiCard } from "@/components/dashboards/charts/lazy";
import { m } from "@/lib/messages";
import type { BudgetProgress } from "@/server/queries/budgets";

type Props = {
  budgets: BudgetProgress[];
  renderMode?: string;
};

function gaugeColor(percent: number): "success" | "warning" | "error" {
  if (percent < 70) return "success";
  if (percent < 90) return "warning";
  return "error";
}

export function BudgetHealthKpi({ budgets, renderMode = "default" }: Props) {
  const activeBudgets = budgets.filter(
    (b) => BigInt(b.amountCents) > 0n || BigInt(b.spentCents) > 0n,
  );

  if (activeBudgets.length === 0) {
    return (
      <KpiCard
        title={m.dashboards.kpi.budgetHealth}
        value="—"
        subtitle="Sem metas"
        color="default"
        icon={FlagIcon}
        renderMode={renderMode}
      />
    );
  }

  const avgPercent = activeBudgets.reduce((sum, b) => sum + b.percent, 0) / activeBudgets.length;
  const clampedPercent = Math.min(Math.max(avgPercent, 0), 100);
  const color = gaugeColor(clampedPercent);

  return (
    <KpiCard
      title={m.dashboards.kpi.budgetHealth}
      value={`${Math.round(clampedPercent)}%`}
      color={color}
      icon={FlagIcon}
      gauge={{ percent: clampedPercent }}
      renderMode={renderMode}
    />
  );
}
