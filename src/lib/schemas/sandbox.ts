import { z } from "zod";

import {
  EXPENSE_TYPE_VALUES,
  SOURCE_VALUES,
  PAYMENT_METHOD_VALUES,
} from "@/lib/transaction-filters/fields";

export const SANDBOX_PERIOD_TYPES = [
  "year",
  "months",
  "last_3_months",
  "last_6_months",
  "current_month",
] as const;
// Dimensões escalares — adicionadas em paridade de filtros (Parte A / A2). `tags` é N:N
// (Transaction↔Tag via TransactionTag) e NÃO entra como dimensão de group/series por ora:
// exigiria lógica de pivot diferente (uma transação pode contribuir para várias tags ao
// mesmo tempo, distorcendo somas/contagens se tratada como dimensão escalar simples).
// Fica de fora aqui; como FILTRO (filterTagIds) segue suportado normalmente.
export const SANDBOX_GROUP_BY = [
  "month",
  "section",
  "category",
  "institution",
  "table_type",
  "expense_type",
  "source",
  "payment_method",
] as const;
export const SANDBOX_SERIES_BY = [
  "section",
  "category",
  "member",
  "institution",
  "table_type",
  "expense_type",
  "source",
  "payment_method",
  "none",
] as const;
export const SANDBOX_METRICS = ["total", "income", "expense", "count", "avg"] as const;
export const SANDBOX_CHART_TYPES = [
  "bar_grouped",
  "bar_stacked",
  "line",
  "area",
  "pie",
  "donut",
] as const;
export const SANDBOX_DASHBOARD_CONTEXTS = ["yearly", "monthly", "both"] as const;

export type SandboxPeriodType = (typeof SANDBOX_PERIOD_TYPES)[number];
export type SandboxGroupBy = (typeof SANDBOX_GROUP_BY)[number];
export type SandboxSeriesBy = (typeof SANDBOX_SERIES_BY)[number];
export type SandboxMetric = (typeof SANDBOX_METRICS)[number];
export type SandboxChartType = (typeof SANDBOX_CHART_TYPES)[number];
export type SandboxDashboardContext = (typeof SANDBOX_DASHBOARD_CONTEXTS)[number];

export const sandboxConfigSchema = z
  .object({
    periodType: z.enum(SANDBOX_PERIOD_TYPES),
    year: z.number().int().min(2000).max(2100).optional(),
    monthIds: z.array(z.string()).optional(),
    groupBy: z.enum(SANDBOX_GROUP_BY),
    seriesBy: z.enum(SANDBOX_SERIES_BY),
    metric: z.enum(SANDBOX_METRICS),
    chartType: z.enum(SANDBOX_CHART_TYPES),
    filterSectionIds: z.array(z.string()).optional(),
    filterCategoryIds: z.array(z.string()).optional(),
    // Guarda partyIds (A1 — todas as kinds de persona), com fallback de legado para userId.
    // Nome do campo mantido por compatibilidade com configs salvas.
    filterMemberIds: z.array(z.string()).optional(),
    // Paridade de filtros (Parte A / A2) — nivelando o sandbox aos 9 campos-alvo.
    filterInstitutionIds: z.array(z.string()).optional(),
    filterTagIds: z.array(z.string()).optional(),
    filterExpenseTypes: z.array(z.enum(EXPENSE_TYPE_VALUES)).optional(),
    filterSources: z.array(z.enum(SOURCE_VALUES)).optional(),
    filterPaymentMethods: z.array(z.enum(PAYMENT_METHOD_VALUES)).optional(),
    filterPending: z.boolean().optional(),
    filterFavorite: z.boolean().optional(),
  })
  .refine(
    (c) => {
      if (c.periodType === "year") return c.year != null;
      if (c.periodType === "months") return (c.monthIds?.length ?? 0) > 0;
      return true;
    },
    { message: "Período inválido" },
  );

export type SandboxConfig = z.infer<typeof sandboxConfigSchema>;

export const getSandboxDataSchema = z.object({
  config: sandboxConfigSchema,
  currentMonthId: z.string().optional(),
});

// ─── UI validation helpers ────────────────────────────────────────────────

// Any dimension can be paired with any other (except the same one)
export function getValidSeriesBy(groupBy: SandboxGroupBy): SandboxSeriesBy[] {
  const all: SandboxSeriesBy[] = [
    "section",
    "category",
    "member",
    "institution",
    "table_type",
    "expense_type",
    "source",
    "payment_method",
    "none",
  ];
  return all.filter((s) => s !== (groupBy as string));
}

export function getValidChartTypes(seriesBy: SandboxSeriesBy): SandboxChartType[] {
  if (seriesBy === "none") return ["bar_grouped", "pie", "donut", "line", "area"];
  return ["bar_grouped", "bar_stacked", "line", "area"];
}

export function getValidMetrics(groupBy: SandboxGroupBy): SandboxMetric[] {
  // category doesn't naturally separate income/expense
  if (groupBy === "category") return ["total", "count", "avg"];
  return ["total", "income", "expense", "count", "avg"];
}

export function autoFixConfig(config: SandboxConfig): SandboxConfig {
  const fixed = { ...config };
  const validSeriesBy = getValidSeriesBy(fixed.groupBy);
  if (!validSeriesBy.includes(fixed.seriesBy)) fixed.seriesBy = "none";
  const validChartTypes = getValidChartTypes(fixed.seriesBy);
  if (!validChartTypes.includes(fixed.chartType)) fixed.chartType = "bar_grouped";
  const validMetrics = getValidMetrics(fixed.groupBy);
  if (!validMetrics.includes(fixed.metric)) fixed.metric = "total";
  return fixed;
}
