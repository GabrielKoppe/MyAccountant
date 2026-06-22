"use client";

// Spec 38 FEAT-02 — Ranking consolidado de gastos por membro no ano.
// Reutiliza MemberBreakdownWidget (gráfico) e MemberListWidget (lista/ranking).
// - compact (2×2): top-3 em lista compacta → MemberListWidget renderMode="compact"
// - default (3×3): gráfico de barras/pizza top-5 → MemberBreakdownWidget renderMode="default"
// - expanded (4×3): gráfico + ranking detalhado → MemberListWidget renderMode="full"

import { MemberBreakdownWidget } from "@/components/dashboards/panels/MemberBreakdownWidget";
import { MemberListWidget } from "@/components/dashboards/panels/MemberListWidget";
import type { MemberBreakdownRow } from "@/lib/queries/member-analytics";
import type { PieChartConfig } from "@/lib/schemas/widget-config";

type Props = {
  rows: MemberBreakdownRow[];
  config?: PieChartConfig;
  renderMode?: "compact" | "default" | "expanded";
};

export function MemberYearlyWidget({ rows, config, renderMode = "default" }: Props) {
  if (renderMode === "compact") {
    return <MemberListWidget rows={rows} renderMode="compact" />;
  }
  if (renderMode === "expanded") {
    return <MemberListWidget rows={rows} renderMode="full" />;
  }
  // default: gráfico de pizza/barras com top-5
  return <MemberBreakdownWidget rows={rows} config={config} renderMode="default" />;
}
