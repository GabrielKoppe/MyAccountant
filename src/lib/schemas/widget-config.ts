import { z } from "zod";

import {
  EXPENSE_TYPE_VALUES,
  SOURCE_VALUES,
  PAYMENT_METHOD_VALUES,
  idArrayField,
  enumArrayField,
  boolFilterField,
} from "@/lib/transaction-filters/fields";

import { SANDBOX_METRICS } from "./sandbox";

// ─────────────────────────────────────────────────────────────────────────────
// Spec 36 §2.2/§2.3 — schemas de configuração interna por widget.
// Declarados fora do WIDGET_REGISTRY (importados pelo registry e pelos forms).
// ─────────────────────────────────────────────────────────────────────────────

// money-flow (Sankey): agrupar o fluxo por seção ou por categoria.
export const moneyFlowConfigSchema = z.object({
  groupBy: z.enum(["section", "category"]).default("category"),
});
export type MoneyFlowConfig = z.infer<typeof moneyFlowConfigSchema>;

// category-treemap: limitar às top N categorias (ou todas).
export const treemapConfigSchema = z.object({
  topN: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal("all")]).default("all"),
});
export type TreemapConfig = z.infer<typeof treemapConfigSchema>;

// budgets: mostrar todas as metas ou apenas as próximas do limite.
// filterExpenseType: filtrar spending por tipo (Spec 41 Fase 14).
export const budgetsConfigSchema = z.object({
  showOnly: z.enum(["all", "near_limit"]).default("all"),
  filterExpenseType: z.enum(["all", "fixed", "variable", "one_time"]).default("all"),
});
export type BudgetsConfig = z.infer<typeof budgetsConfigSchema>;

// top-transactions: quantas transações exibir.
// filterSource: filtrar por origem da transação (Spec 41 Fase 14).
export const topTransactionsConfigSchema = z.object({
  limit: z.union([z.literal(5), z.literal(10), z.literal(20)]).default(10),
  excludeSectionIds: z.array(z.string()).default([]),
  filterSource: z
    .enum(["all", "manual", "csv_import", "xlsx_import", "template", "auto_template", "duplicate"])
    .default("all"),
});
export type TopTransactionsConfig = z.infer<typeof topTransactionsConfigSchema>;

// kpi-custom: KPI de uma métrica arbitrária (período = contexto do dashboard).
// Subconjunto do sandboxConfigSchema (spec 36 §2.3) + rótulo livre.
export const kpiCustomConfigSchema = z.object({
  label: z.string().max(40).optional(),
  metric: z.enum(SANDBOX_METRICS).default("total"),
  filterSectionIds: z.array(z.string()).optional(),
  filterCategoryIds: z.array(z.string()).optional(),
  filterMemberIds: z.array(z.string()).optional(),
});
export type KpiCustomConfig = z.infer<typeof kpiCustomConfigSchema>;

// filtered-transactions: reutiliza a estrutura de filtros do mês
// (MonthFilterState: categorias, instituições, responsáveis, pendente, favorita, tipos de
// transação, origens, tags, método de pagamento) + limite. Paridade de filtros (Parte A).
// `responsible` guarda partyIds (todas as kinds de persona) — ver responsiblePartyIdsForFilter.
export const filteredTransactionsConfigSchema = z.object({
  categories: idArrayField(),
  institutions: idArrayField(),
  responsible: idArrayField(),
  pending: boolFilterField(),
  favorite: boolFilterField(),
  expenseTypes: enumArrayField(EXPENSE_TYPE_VALUES),
  sources: enumArrayField(SOURCE_VALUES),
  paymentMethods: enumArrayField(PAYMENT_METHOD_VALUES),
  tags: idArrayField(),
  // 0 = sem limite (busca todas)
  limit: z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(20)]).default(10),
});
export type FilteredTransactionsConfig = z.infer<typeof filteredTransactionsConfigSchema>;

// member-breakdown: tipo de visualização + filtro por expenseType (Spec 41 Fase 14).
export const memberBreakdownConfigSchema = z.object({
  view: z.enum(["donut", "bars"]).default("donut"),
  filterExpenseType: z.enum(["all", "fixed", "variable", "one_time"]).default("all"),
});
export type MemberBreakdownConfig = z.infer<typeof memberBreakdownConfigSchema>;

// top-categories: limitar às top N categorias exibidas (anual).
export const topCategoriesConfigSchema = z.object({
  limit: z.union([z.literal(5), z.literal(10), z.literal(20)]).default(10),
});
export type TopCategoriesConfig = z.infer<typeof topCategoriesConfigSchema>;

// section-breakdown / institution-breakdown: tipo de gráfico.
export const pieChartConfigSchema = z.object({
  chartType: z.enum(["pie", "bar", "hbar", "vbar"]).default("pie"),
});
export type PieChartConfig = z.infer<typeof pieChartConfigSchema>;

// category-breakdown: tipo de gráfico + filtro por tag e expenseType (Spec 41 Fase 14).
export const categoryBreakdownConfigSchema = z.object({
  chartType: z.enum(["pie", "bar", "hbar", "vbar"]).default("pie"),
  filterTagIds: z.array(z.string()).default([]),
  filterExpenseType: z.enum(["all", "fixed", "variable", "one_time"]).default("all"),
});
export type CategoryBreakdownConfig = z.infer<typeof categoryBreakdownConfigSchema>;

// daily-heatmap: quais transações considerar + como colorir (Spec 41 Fase 14).
// colorBy "intensity": gradiente por volume de gasto (comportamento original).
// colorBy "expense_type": cor baseada no tipo dominante (fixo/variável/único) do dia.
export const dailyHeatmapConfigSchema = z.object({
  metric: z.enum(["expense", "all_activity"]).default("expense"),
  colorBy: z.enum(["intensity", "expense_type"]).default("intensity"),
});
export type DailyHeatmapConfig = z.infer<typeof dailyHeatmapConfigSchema>;

// institution-breakdown: usa pieChartConfigSchema (tipo de gráfico) como base.
// Alias semântico — nenhuma lógica extra necessária.

// week-chart: métrica exibida nas barras semanais.
export const weekChartConfigSchema = z.object({
  metric: z.enum(["expense", "income", "both"]).default("expense"),
});
export type WeekChartConfig = z.infer<typeof weekChartConfigSchema>;

// kpi-transaction-count: filtros opcionais para o contador de transações.
export const transactionCountConfigSchema = z.object({
  countInMonth: z.enum(["all", "only"]).default("all"),
  // "all" = sem filtro; "only" = apenas tabelas com countInMonth = true
  sectionType: z.enum(["all", "subtract", "add"]).default("all"),
  // "all" = sem filtro; "subtract" = só despesas; "add" = só receitas
  includePending: z.boolean().default(true),
  // false = excluir transações com isPending = true
});
export type TransactionCountConfig = z.infer<typeof transactionCountConfigSchema>;

// analysis (instanciável): re-exporta sandboxConfigSchema como configSchema do widget.
// Mantém schema único — UI filtra opções por contexto no formulário de config.
export { sandboxConfigSchema as analysisConfigSchema } from "@/lib/schemas/sandbox";
export type { SandboxConfig as AnalysisConfig } from "@/lib/schemas/sandbox";
