"use client";

import TuneIcon from "@mui/icons-material/Tune";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import type { KpiCustomConfig } from "@/lib/schemas/widget-config";
import type { KpiCustomResult } from "@/lib/queries/kpi-custom";
import { KpiSparklineCard } from "./KpiSparklineCard";

const METRIC_LABELS: Record<KpiCustomConfig["metric"], string> = {
  total: m.dashboards.sandbox.controls.metricTotal,
  income: m.dashboards.sandbox.controls.metricIncome,
  expense: m.dashboards.sandbox.controls.metricExpense,
  count: m.dashboards.sandbox.controls.metricCount,
  avg: m.dashboards.sandbox.controls.metricAvg,
};

type Props = {
  config: KpiCustomConfig;
  data: KpiCustomResult | null;
};

export function KpiCustomWidget({ config, data }: Props) {
  const title = config.label?.trim() || METRIC_LABELS[config.metric];

  if (!data) {
    return <KpiSparklineCard title={title} value="—" icon={TuneIcon} />;
  }

  const value =
    data.metric === "count" ? String(data.count) : formatCentsToBrl(BigInt(data.valueCents));

  let color: "default" | "success" | "error" = "default";
  if (data.metric === "income") color = "success";
  else if (data.metric === "expense") color = "error";
  else if (data.metric === "total" || data.metric === "avg") {
    color = BigInt(data.valueCents) >= 0n ? "success" : "error";
  }

  return <KpiSparklineCard title={title} value={value} color={color} icon={TuneIcon} />;
}
