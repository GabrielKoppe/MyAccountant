import { z } from "zod";

import type { ReadContext } from "@/server/mcp/visibility";
import {
  getYearOverview,
  getMonthDeepDive,
  getMonthSparklineData,
  getComparisonData,
  getDailyTotals,
  getCategoryBreakdownFiltered,
  getCategoryTreemapData,
  getSankeyData,
  getTransactionsByIds,
  getYearDeepDive,
  getInstitutionBreakdown,
  getWeeklySpending,
  getTransactionCount,
} from "@/server/queries/dashboards";

/**
 * Catálogo de tools MCP — wrappers finos sobre `src/server/queries/dashboards.ts` (DD-10, fase 1/N;
 * as demais queries de `src/server/queries/` — month-page, insights, member-analytics, budgets,
 * kpi-custom, filtered-transactions — ficam para a Task 1.3b).
 *
 * Invariante de multi-tenancy (DD-04): nenhum `shape` expõe `accountId`. `run` SEMPRE usa
 * `ctx.accountId` (vindo da concessão OAuth via `ReadContext`), nunca um valor do input do modelo.
 *
 * `shape` é um `ZodRawShape` (não um `z.object`) porque é isso que
 * `server.registerTool(name, { inputSchema: tool.shape }, cb)` do SDK MCP espera (Task 2.2).
 * Para validar/testar um input, derive o schema com `z.object(tool.shape)` — não guardamos um
 * campo `schema` separado no tipo.
 */
export type McpTool<TShape extends z.ZodRawShape = z.ZodRawShape> = {
  name: string;
  description: string;
  shape: TShape;
  run: (ctx: ReadContext, args: z.infer<z.ZodObject<TShape>>) => Promise<unknown>;
};

// ─── get_category_breakdown ────────────────────────────────────────
// expenseType como string p/ não acoplar ao enum Prisma TransactionExpenseType.

const categoryBreakdownShape = {
  monthId: z.string(),
  filterExpenseType: z.string().default("all"),
  filterTagIds: z.array(z.string()).default([]),
};

const getCategoryBreakdownTool: McpTool<typeof categoryBreakdownShape> = {
  name: "get_category_breakdown",
  description:
    "Gastos agregados por categoria em um mês da conta, com filtro opcional por tags e tipo de despesa.",
  shape: categoryBreakdownShape,
  run: (ctx, input) =>
    getCategoryBreakdownFiltered(ctx.accountId, input.monthId, {
      filterExpenseType: input.filterExpenseType,
      filterTagIds: input.filterTagIds,
    }),
};

// ─── get_year_overview ──────────────────────────────────────────────

const yearOverviewShape = {
  year: z.number().int(),
};

const getYearOverviewTool: McpTool<typeof yearOverviewShape> = {
  name: "get_year_overview",
  description:
    "Visão geral de um ano da conta: seções, totais mensais, top categorias e contagem de pendentes.",
  shape: yearOverviewShape,
  run: (ctx, input) => getYearOverview(ctx.accountId, input.year),
};

// ─── get_month_deep_dive ────────────────────────────────────────────

const monthDeepDiveShape = {
  monthId: z.string(),
};

const getMonthDeepDiveTool: McpTool<typeof monthDeepDiveShape> = {
  name: "get_month_deep_dive",
  description:
    "Detalhe de um mês da conta: totais por seção, top transações, transações favoritas e top categorias.",
  shape: monthDeepDiveShape,
  run: (ctx, input) => getMonthDeepDive(ctx.accountId, input.monthId),
};

// ─── get_month_sparkline ────────────────────────────────────────────

const monthSparklineShape = {
  currentMonthId: z.string(),
};

const getMonthSparklineTool: McpTool<typeof monthSparklineShape> = {
  name: "get_month_sparkline",
  description:
    "Série histórica (últimos 6 meses) de total, receita e despesa, para linhas de tendência (sparkline).",
  shape: monthSparklineShape,
  run: (ctx, input) => getMonthSparklineData(ctx.accountId, input.currentMonthId),
};

// ─── get_comparison_data ────────────────────────────────────────────

const comparisonDataShape = {
  currentMonthId: z.string(),
};

const getComparisonDataTool: McpTool<typeof comparisonDataShape> = {
  name: "get_comparison_data",
  description:
    "Compara o mês atual com o mesmo mês do ano anterior e com a média dos últimos 3 meses.",
  shape: comparisonDataShape,
  run: (ctx, input) => getComparisonData(ctx.accountId, input.currentMonthId),
};

// ─── get_daily_totals ───────────────────────────────────────────────

const dailyTotalsShape = {
  monthId: z.string(),
  // null = toda atividade financeira (countInMonth); array = apenas as seções informadas.
  subtractSectionIds: z.array(z.string()).nullable(),
};

const getDailyTotalsTool: McpTool<typeof dailyTotalsShape> = {
  name: "get_daily_totals",
  description:
    "Totais diários de um mês (para heatmap de calendário). subtractSectionIds=null considera toda atividade financeira; um array filtra por seções específicas.",
  shape: dailyTotalsShape,
  run: (ctx, input) => getDailyTotals(ctx.accountId, input.monthId, input.subtractSectionIds),
};

// ─── get_category_treemap ───────────────────────────────────────────

const categoryTreemapShape = {
  monthId: z.string(),
};

const getCategoryTreemapTool: McpTool<typeof categoryTreemapShape> = {
  name: "get_category_treemap",
  description:
    "Gastos de um mês agrupados em árvore categoria → subcategoria, com totais e ids de transações.",
  shape: categoryTreemapShape,
  run: (ctx, input) => getCategoryTreemapData(ctx.accountId, input.monthId),
};

// ─── get_sankey_data ────────────────────────────────────────────────
// AMBÍGUO (ver relatório): a query espera `sections`/`sectionTotals` já calculados
// (normalmente vindos de get_month_deep_dive ou get_year_overview), não apenas ids —
// mirrorado fielmente aqui, mas é um formato incomum para um modelo montar do zero.

const sectionMetaShape = z.object({
  id: z.string(),
  name: z.string(),
  // SectionCountType (enum Prisma: add|subtract|ignore|neutral) — mirrorado fielmente do schema.
  countType: z.enum(["add", "subtract", "ignore", "neutral"]),
});

const sankeyDataShape = {
  monthId: z.string(),
  sections: z.array(sectionMetaShape),
  // sectionId → total em centavos (string, BigInt serializado)
  sectionTotals: z.record(z.string(), z.string()),
  groupBy: z.enum(["section", "category"]).default("category"),
};

const getSankeyDataTool: McpTool<typeof sankeyDataShape> = {
  name: "get_sankey_data",
  description:
    "Diagrama Sankey (fontes → total disponível → categorias/seções de gasto → poupança) de um mês. Recebe as seções e os totais por seção já calculados (ex.: retornados por get_month_deep_dive ou get_year_overview).",
  shape: sankeyDataShape,
  run: (ctx, input) =>
    getSankeyData(
      ctx.accountId,
      input.monthId,
      input.sections,
      input.sectionTotals,
      input.groupBy,
    ),
};

// ─── get_transactions_by_ids ────────────────────────────────────────

const transactionsByIdsShape = {
  ids: z.array(z.string()),
};

const getTransactionsByIdsTool: McpTool<typeof transactionsByIdsShape> = {
  name: "get_transactions_by_ids",
  description:
    "Detalhe de transações específicas por id (drill-down a partir do resultado de outra tool).",
  shape: transactionsByIdsShape,
  run: (ctx, input) => getTransactionsByIds(ctx.accountId, input.ids),
};

// ─── get_year_deep_dive ─────────────────────────────────────────────

const yearDeepDiveShape = {
  year: z.number().int(),
};

const getYearDeepDiveTool: McpTool<typeof yearDeepDiveShape> = {
  name: "get_year_deep_dive",
  description:
    "Detalhe de um ano da conta: seções, totais mensais, top categorias e top instituições.",
  shape: yearDeepDiveShape,
  run: (ctx, input) => getYearDeepDive(ctx.accountId, input.year),
};

// ─── get_institution_breakdown ──────────────────────────────────────

const institutionBreakdownShape = {
  monthId: z.string(),
};

const getInstitutionBreakdownTool: McpTool<typeof institutionBreakdownShape> = {
  name: "get_institution_breakdown",
  description: "Gastos de um mês agrupados por instituição financeira.",
  shape: institutionBreakdownShape,
  run: (ctx, input) => getInstitutionBreakdown(ctx.accountId, input.monthId),
};

// ─── get_weekly_spending ────────────────────────────────────────────

const weeklySpendingShape = {
  monthId: z.string(),
  // Dia de início do período do mês (account_settings.monthStartDay).
  monthStartDay: z.number().int().min(1).max(31),
  metric: z.enum(["expense", "income", "both"]).default("expense"),
};

const getWeeklySpendingTool: McpTool<typeof weeklySpendingShape> = {
  name: "get_weekly_spending",
  description:
    "Gastos/receitas semanais de um mês, com semanas calculadas a partir do dia de início do mês da conta.",
  shape: weeklySpendingShape,
  run: (ctx, input) =>
    getWeeklySpending(ctx.accountId, input.monthId, input.monthStartDay, input.metric),
};

// ─── get_transaction_count ──────────────────────────────────────────

const transactionCountShape = {
  periodFilter: z.union([
    z.object({ monthId: z.string() }),
    z.object({ monthIds: z.array(z.string()) }),
  ]),
  options: z
    .object({
      countInMonth: z.enum(["all", "only"]).optional(),
      sectionType: z.enum(["all", "subtract", "add"]).optional(),
      includePending: z.boolean().optional(),
    })
    .optional(),
};

const getTransactionCountTool: McpTool<typeof transactionCountShape> = {
  name: "get_transaction_count",
  description:
    "Conta transações de um mês ou de um conjunto de meses da conta, com filtros opcionais de seção e status pendente.",
  shape: transactionCountShape,
  run: (ctx, input) => getTransactionCount(ctx.accountId, input.periodFilter, input.options),
};

// ─── Catálogo ───────────────────────────────────────────────────────

// Cada tool tem um `TShape` concreto mais específico que `z.ZodRawShape` (o default do tipo);
// o cast via `unknown` apaga esse detalhe ao guardar no catálogo homogêneo — `run` de cada tool
// só é chamado com o `args` já validado pelo próprio `shape` (Task 2.2), então é seguro.
export const mcpTools: Record<string, McpTool> = {
  [getCategoryBreakdownTool.name]: getCategoryBreakdownTool as unknown as McpTool,
  [getYearOverviewTool.name]: getYearOverviewTool as unknown as McpTool,
  [getMonthDeepDiveTool.name]: getMonthDeepDiveTool as unknown as McpTool,
  [getMonthSparklineTool.name]: getMonthSparklineTool as unknown as McpTool,
  [getComparisonDataTool.name]: getComparisonDataTool as unknown as McpTool,
  [getDailyTotalsTool.name]: getDailyTotalsTool as unknown as McpTool,
  [getCategoryTreemapTool.name]: getCategoryTreemapTool as unknown as McpTool,
  [getSankeyDataTool.name]: getSankeyDataTool as unknown as McpTool,
  [getTransactionsByIdsTool.name]: getTransactionsByIdsTool as unknown as McpTool,
  [getYearDeepDiveTool.name]: getYearDeepDiveTool as unknown as McpTool,
  [getInstitutionBreakdownTool.name]: getInstitutionBreakdownTool as unknown as McpTool,
  [getWeeklySpendingTool.name]: getWeeklySpendingTool as unknown as McpTool,
  [getTransactionCountTool.name]: getTransactionCountTool as unknown as McpTool,
};
