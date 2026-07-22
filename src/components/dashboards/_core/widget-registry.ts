import type { z } from "zod";

import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import {
  analysisConfigSchema,
  budgetsConfigSchema,
  categoryBreakdownConfigSchema,
  dailyHeatmapConfigSchema,
  filteredTransactionsConfigSchema,
  kpiCustomConfigSchema,
  memberBreakdownConfigSchema,
  moneyFlowConfigSchema,
  pieChartConfigSchema,
  topCategoriesConfigSchema,
  topTransactionsConfigSchema,
  transactionCountConfigSchema,
  treemapConfigSchema,
  weekChartConfigSchema,
} from "@/lib/schemas/widget-config";

export type WidgetKind = "kpi" | "panel";
export type DashboardContext = "monthly" | "yearly" | "month_summary";

// ─────────────────────────────────────────────────────────────────────────────
// Spec 36 — Variantes de tamanho e grade 2D
// ─────────────────────────────────────────────────────────────────────────────

export type WidgetSizeVariant = {
  id: string; // ex: 'default', 'compact', 'large'
  labelKey: string; // chave i18n para nome da variante no editor
  w: number; // largura em colunas (1–6)
  h: number; // altura em linhas (≥1)
  renderMode: string; // string opaca passada como prop ao componente
};

export type DashboardGridConfig = {
  cols: number; // sempre 6
  initialRows: number; // linhas exibidas ao abrir o editor
  maxRows: number; // limite máximo de linhas
};

export const GRID_CONFIG: Record<DashboardContext, DashboardGridConfig> = {
  // initialRows=13: acomoda o layout padrão (top-transactions termina em y+h=13).
  // maxRows=14: margem de uma linha acima do layout padrão gerado pelo binPack.
  monthly: { cols: 6, initialRows: 13, maxRows: 14 },
  yearly: { cols: 6, initialRows: 8, maxRows: 12 },
  month_summary: { cols: 6, initialRows: 6, maxRows: 10 },
};

export type WidgetDef = {
  id: string;
  labelKey: string;
  kind: WidgetKind;
  sizeVariants: WidgetSizeVariant[]; // sizeVariants[0] = variante default
  defaultVisible: boolean;
  instantiable?: boolean; // default false = singleton
  configSchema?: z.ZodTypeAny; // opcional p/ singletons com config; obrigatório p/ instantiable (fases 5/6)
  defaultConfig?: unknown;
};

// ─────────────────────────────────────────────────────────────────────────────
// Variantes reutilizadas (ver tabela §2.6). sizeVariants[0] é sempre a default.
// ─────────────────────────────────────────────────────────────────────────────

const KPI_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 1, h: 1, renderMode: "default" },
  { id: "wide", labelKey: "wide", w: 2, h: 1, renderMode: "wide" },
];

// default 6×2, compact 3×2, large 6×3
const WIDE_CHART_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 6, h: 2, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 3, h: 2, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 6, h: 3, renderMode: "expanded" },
];
// top-transactions: compact 3×2, default 3×3, large 4×3
const TOP_TX_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 3, h: 2, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 4, h: 3, renderMode: "expanded" },
];
// member-trend: compact 3×2 e default 6×2 (sem large)
const MEMBER_TREND_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 6, h: 2, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 3, h: 2, renderMode: "compact" },
];
// member-list: compact 2×1 (carrossel), default 2×3 (ranking), full 3×3 (ranking + categorias)
const MEMBER_LIST_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 2, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 1, renderMode: "compact" },
  { id: "full", labelKey: "full", w: 3, h: 3, renderMode: "full" },
]; // member-radar: compact 2×2, default 3×3
const MEMBER_RADAR_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 2, renderMode: "compact" },
]; // default 3×3, compact 2×2, large 4×3
const SQUARE_CHART_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 2, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 4, h: 3, renderMode: "full" },
];

// daily-heatmap: compact 2×3, default 3×4 (sem "large" — mais lindo = não necessário).
const DAILY_HEATMAP_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 4, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 3, renderMode: "compact" },
];

// default 3×3, compact 2×2, large 4×4
const PIE_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 2, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 4, h: 4, renderMode: "full" },
];

const BUDGETS_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 2, renderMode: "default" },
  { id: "small", labelKey: "small", w: 2, h: 1, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 6, h: 3, renderMode: "full" },
];

const SECTION_CARDS_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 6, h: 1, renderMode: "default" },
  { id: "small", labelKey: "small", w: 4, h: 1, renderMode: "small" },
  // compact é invertido: 1 coluna × 2 linhas — lista vertical de links coloridos.
  { id: "compact", labelKey: "compact", w: 1, h: 2, renderMode: "compact" },
];

// pending/favorite/recent: compact 1×2, default 2×3, large 3×3
const ACTIVITY_ITEM_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 2, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 1, h: 2, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 3, h: 3, renderMode: "full" },
];

// insights: compact 2×1, default 3×1, large 3×2
const INSIGHTS_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 1, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 1, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 3, h: 2, renderMode: "full" },
];

const MONEY_FLOW_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 6, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 3, h: 3, renderMode: "compact" },
];

const MONTH_CARD_GRID_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 6, h: 1, renderMode: "default" },
  { id: "small", labelKey: "small", w: 4, h: 1, renderMode: "small" },
  { id: "compact", labelKey: "compact", w: 2, h: 1, renderMode: "compact" },
];

const MONTHLY_BAR_CHART_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 6, h: 2, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 3, h: 2, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 6, h: 3, renderMode: "expanded" },
];

const ANALYSIS_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default" },
  { id: "small", labelKey: "small", w: 2, h: 2, renderMode: "compact" },
  { id: "compact", labelKey: "compact", w: 3, h: 2, renderMode: "compact" },
  { id: "medium", labelKey: "medium", w: 4, h: 3, renderMode: "default" },
  { id: "large", labelKey: "large", w: 4, h: 4, renderMode: "expanded" },
  { id: "giant", labelKey: "giant", w: 6, h: 4, renderMode: "expanded" },
];

// ─── Spec 38 — novos widgets ──────────────────────────────────────────────────

// institution-breakdown: mesmo padrão de section-breakdown / category-breakdown (PIE_VARIANTS)
const INSTITUTION_BREAKDOWN_VARIANTS: WidgetSizeVariant[] = PIE_VARIANTS;

// week-chart: compact 2×1 (mini-barras), default 3×2 (barras+rótulos), large 4×3 (barras+valores+média)
const WEEK_CHART_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 2, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 1, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 4, h: 3, renderMode: "expanded" },
];

// member-yearly: compact 2×1 (carrossel de cards), default 3×3 (gráfico+top-5), large 4×3 (gráfico+ranking detalhado)
const MEMBER_YEARLY_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 1, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 4, h: 3, renderMode: "expanded" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Registry — fonte da verdade dos widgets por contexto (spec 36 §7.4)
// ─────────────────────────────────────────────────────────────────────────────

export const WIDGET_REGISTRY: Record<DashboardContext, WidgetDef[]> = {
  monthly: [
    {
      id: "kpi-month-total",
      labelKey: "monthTotal",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-income",
      labelKey: "income",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-expenses",
      labelKey: "expenses",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-savings-rate",
      labelKey: "savingsRate",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-top-category",
      labelKey: "topCategory",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-pending",
      labelKey: "pending",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "budgets",
      labelKey: "budgets",
      kind: "panel",
      sizeVariants: BUDGETS_VARIANTS,
      defaultVisible: true,
      configSchema: budgetsConfigSchema,
      defaultConfig: { showOnly: "all" },
    },
    {
      id: "daily-heatmap",
      labelKey: "dailyHeatmap",
      kind: "panel",
      sizeVariants: DAILY_HEATMAP_VARIANTS,
      defaultVisible: true,
      configSchema: dailyHeatmapConfigSchema,
      defaultConfig: { metric: "expense" },
    },
    {
      id: "category-treemap",
      labelKey: "categoryTreemap",
      kind: "panel",
      sizeVariants: SQUARE_CHART_VARIANTS,
      defaultVisible: true,
      configSchema: treemapConfigSchema,
      defaultConfig: { topN: "all" },
    },
    {
      id: "money-flow",
      labelKey: "moneyFlow",
      kind: "panel",
      sizeVariants: MONEY_FLOW_VARIANTS,
      defaultVisible: true,
      configSchema: moneyFlowConfigSchema,
      defaultConfig: { groupBy: "category" },
    },
    {
      id: "section-breakdown",
      labelKey: "sectionBreakdown",
      kind: "panel",
      sizeVariants: PIE_VARIANTS,
      defaultVisible: true,
      configSchema: pieChartConfigSchema,
      defaultConfig: { chartType: "pie" },
    },
    {
      id: "category-breakdown",
      labelKey: "categoryBreakdown",
      kind: "panel",
      sizeVariants: PIE_VARIANTS,
      defaultVisible: true,
      configSchema: categoryBreakdownConfigSchema,
      defaultConfig: { chartType: "pie", filterTagIds: [], filterExpenseType: "all" },
    },
    {
      id: "top-transactions",
      labelKey: "topTransactions",
      kind: "panel",
      sizeVariants: TOP_TX_VARIANTS,
      defaultVisible: true,
      configSchema: topTransactionsConfigSchema,
      defaultConfig: { limit: 10 },
    },
    {
      id: "insights",
      labelKey: "insights",
      kind: "panel",
      sizeVariants: INSIGHTS_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "member-breakdown",
      labelKey: "memberBreakdown",
      kind: "panel",
      sizeVariants: PIE_VARIANTS,
      defaultVisible: false,
      configSchema: memberBreakdownConfigSchema,
      defaultConfig: { view: "donut", filterExpenseType: "all" },
    },
    {
      id: "member-list",
      labelKey: "memberList",
      kind: "panel",
      sizeVariants: MEMBER_LIST_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "member-radar",
      labelKey: "memberRadar",
      kind: "panel",
      sizeVariants: MEMBER_RADAR_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "analysis",
      labelKey: "analysis",
      kind: "panel",
      sizeVariants: ANALYSIS_VARIANTS,
      defaultVisible: false,
      instantiable: true,
      configSchema: analysisConfigSchema,
      defaultConfig: {
        periodType: "current_month",
        groupBy: "category",
        seriesBy: "none",
        metric: "total",
        chartType: "bar_grouped",
      },
    },
    {
      id: "kpi-custom",
      labelKey: "kpiCustom",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: false,
      instantiable: true,
      configSchema: kpiCustomConfigSchema,
      defaultConfig: { metric: "total" },
    },
    // ─── Spec 38 ───────────────────────────────────────────────────────────
    {
      id: "kpi-budget-health",
      labelKey: "budgetHealth",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "kpi-transaction-count",
      labelKey: "transactionCount",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: false,
      configSchema: transactionCountConfigSchema,
      defaultConfig: { countInMonth: "all", sectionType: "all", includePending: true },
    },
    {
      id: "institution-breakdown",
      labelKey: "institutionBreakdown",
      kind: "panel",
      sizeVariants: INSTITUTION_BREAKDOWN_VARIANTS,
      defaultVisible: false,
      configSchema: pieChartConfigSchema,
      defaultConfig: { chartType: "pie" },
    },
    {
      id: "week-chart",
      labelKey: "weekChart",
      kind: "panel",
      sizeVariants: WEEK_CHART_VARIANTS,
      defaultVisible: false,
      configSchema: weekChartConfigSchema,
      defaultConfig: { metric: "expense" },
    },
  ],
  yearly: [
    {
      id: "kpi-year-total",
      labelKey: "yearTotal",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-income",
      labelKey: "income",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-expenses",
      labelKey: "expenses",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-savings-rate",
      labelKey: "savingsRate",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-monthly-avg",
      labelKey: "monthlyAvg",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-best-month",
      labelKey: "bestMonth",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-worst-month",
      labelKey: "worstMonth",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-pending",
      labelKey: "pending",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "month-card-grid",
      labelKey: "monthCardGrid",
      kind: "panel",
      sizeVariants: MONTH_CARD_GRID_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "monthly-bar-chart",
      labelKey: "monthlyBarChart",
      kind: "panel",
      sizeVariants: MONTHLY_BAR_CHART_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "top-categories",
      labelKey: "topCategories",
      kind: "panel",
      sizeVariants: [
        { id: "default", labelKey: "default", w: 3, h: 2, renderMode: "default" },
        { id: "compact", labelKey: "compact", w: 2, h: 2, renderMode: "compact" },
        { id: "large", labelKey: "large", w: 6, h: 3, renderMode: "full" },
      ],
      defaultVisible: true,
      configSchema: topCategoriesConfigSchema,
      defaultConfig: { limit: 10 },
    },
    {
      id: "member-trend",
      labelKey: "memberTrend",
      kind: "panel",
      sizeVariants: MEMBER_TREND_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "insights",
      labelKey: "insights",
      kind: "panel",
      sizeVariants: INSIGHTS_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "analysis",
      labelKey: "analysis",
      kind: "panel",
      sizeVariants: ANALYSIS_VARIANTS,
      defaultVisible: false,
      instantiable: true,
      configSchema: analysisConfigSchema,
      defaultConfig: {
        periodType: "year",
        groupBy: "category",
        seriesBy: "none",
        metric: "total",
        chartType: "bar_grouped",
      },
    },
    {
      id: "kpi-custom",
      labelKey: "kpiCustom",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: false,
      instantiable: true,
      configSchema: kpiCustomConfigSchema,
      defaultConfig: { metric: "total" },
    },
    // ─── Spec 38 ───────────────────────────────────────────────────────────
    {
      id: "kpi-transaction-count",
      labelKey: "transactionCount",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: false,
      configSchema: transactionCountConfigSchema,
      defaultConfig: { countInMonth: "all", sectionType: "all", includePending: true },
    },
    {
      id: "member-yearly",
      labelKey: "memberYearly",
      kind: "panel",
      sizeVariants: MEMBER_YEARLY_VARIANTS,
      defaultVisible: false,
    },
    // ─── Spec 46 ────────────────────────────────────────────────────────────
    {
      id: "net-worth-evolution",
      labelKey: "netWorthEvolution",
      kind: "panel",
      sizeVariants: WIDE_CHART_VARIANTS,
      defaultVisible: false,
    },
    // ─── Spec 48 ────────────────────────────────────────────────────────────
    // Opt-in: reflete a projeção da account (forecast.scenarioDefault), sem config por instância.
    {
      id: "cashflow-forecast",
      labelKey: "cashflowForecast",
      kind: "panel",
      sizeVariants: WIDE_CHART_VARIANTS,
      defaultVisible: false,
    },
  ],
  month_summary: [
    {
      id: "kpi-income",
      labelKey: "income",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-expenses",
      labelKey: "expenses",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "kpi-balance",
      labelKey: "balance",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "budgets",
      labelKey: "budgets",
      kind: "panel",
      sizeVariants: BUDGETS_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "section-cards",
      labelKey: "sectionCards",
      kind: "panel",
      sizeVariants: SECTION_CARDS_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "pending-transactions",
      labelKey: "pendingTransactions",
      kind: "panel",
      sizeVariants: ACTIVITY_ITEM_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "favorite-transactions",
      labelKey: "favoriteTransactions",
      kind: "panel",
      sizeVariants: ACTIVITY_ITEM_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "recent-transactions",
      labelKey: "recentTransactions",
      kind: "panel",
      sizeVariants: ACTIVITY_ITEM_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "insights",
      labelKey: "insights",
      kind: "panel",
      sizeVariants: INSIGHTS_VARIANTS,
      defaultVisible: false,
    },
    {
      // Singleton exclusivo do Resumo do Mês (Spec 36). Sem configSchema.
      // Mesmas variantes das listas de atividade (pendentes/favoritas) — mesmo
      // padrão visual de lista compacta: compact 1×2, default 2×3, large 3×3.
      id: "checklist",
      labelKey: "checklist",
      kind: "panel",
      sizeVariants: ACTIVITY_ITEM_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "kpi-custom",
      labelKey: "kpiCustom",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: false,
      instantiable: true,
      configSchema: kpiCustomConfigSchema,
      defaultConfig: { metric: "total" },
    },
    {
      id: "filtered-transactions",
      labelKey: "filteredTransactions",
      kind: "panel",
      sizeVariants: WIDE_CHART_VARIANTS,
      defaultVisible: false,
      instantiable: true,
      configSchema: filteredTransactionsConfigSchema,
      defaultConfig: {
        categories: [],
        institutions: [],
        responsible: [],
        pending: false,
        favorite: false,
        expenseTypes: [],
        sources: [],
        paymentMethods: [],
        tags: [],
        limit: 10,
      },
    },
    // ─── Spec 38 ───────────────────────────────────────────────────────────
    {
      id: "kpi-pending",
      labelKey: "pending",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "kpi-transaction-count",
      labelKey: "transactionCount",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: false,
      configSchema: transactionCountConfigSchema,
      defaultConfig: { countInMonth: "all", sectionType: "all", includePending: true },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Spec 36 — Reconciliação de layout em grade (StoredWidget)
// ─────────────────────────────────────────────────────────────────────────────

function buildOccupancy(items: StoredWidget[]): Set<string> {
  const occ = new Set<string>();
  for (const it of items) {
    for (let dy = 0; dy < it.h; dy++) {
      for (let dx = 0; dx < it.w; dx++) {
        occ.add(`${it.x + dx},${it.y + dy}`);
      }
    }
  }
  return occ;
}

function fitsAt(occ: Set<string>, x: number, y: number, w: number, h: number): boolean {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (occ.has(`${x + dx},${y + dy}`)) return false;
    }
  }
  return true;
}

function markOccupied(occ: Set<string>, x: number, y: number, w: number, h: number): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      occ.add(`${x + dx},${y + dy}`);
    }
  }
}

// Posiciona uma lista de WidgetDef em células livres, linha por linha,
// esquerda para direita, usando a variante default (sizeVariants[0]).
// Para singletons no layout inicial, instanceId === widgetId.
// maxRows (opcional): não posiciona widgets além desse limite — garante que o
// layout gerado passe na validação de upsertLayout.
function binPack(
  defs: WidgetDef[],
  cols: number,
  existingItems: StoredWidget[] = [],
  maxRows?: number,
): StoredWidget[] {
  const occ = buildOccupancy(existingItems);
  const result: StoredWidget[] = [];

  for (const def of defs) {
    const variant = def.sizeVariants[0];
    const w = Math.min(variant.w, cols);
    let placed = false;
    // Limite superior de y: se maxRows definido, widget deve caber inteiramente.
    const yLimit = maxRows !== undefined ? maxRows - variant.h : Infinity;
    for (let y = 0; y <= yLimit && !placed; y++) {
      for (let x = 0; x + w <= cols; x++) {
        if (fitsAt(occ, x, y, w, variant.h)) {
          markOccupied(occ, x, y, w, variant.h);
          result.push({
            instanceId: def.id,
            widgetId: def.id,
            visible: true,
            x,
            y,
            w,
            h: variant.h,
            sizeVariantId: variant.id,
          });
          placed = true;
          break;
        }
      }
    }
    // Se não coube dentro de maxRows, o widget é omitido do layout inicial
    // (comportamento explícito: grade cheia é sinal de que maxRows precisa crescer).
  }

  return result;
}

// Reconcilia o layout salvo (StoredWidget[]) com o registry do contexto.
// - stored = null → layout inicial: bin-pack de todos os defaultVisible.
// - widgetId desconhecido → descartado silenciosamente.
// - sizeVariantId desconhecido → fallback para sizeVariants[0].
// - Widgets defaultVisible ausentes do layout salvo são auto-inseridos (compat-forward:
//   garante que novos widgets adicionados ao registry apareçam nos dashboards existentes).
export function resolveLayout(
  context: DashboardContext,
  stored: StoredWidget[] | null,
): StoredWidget[] {
  const registry = WIDGET_REGISTRY[context];
  const { cols } = GRID_CONFIG[context];

  if (stored === null) {
    const { maxRows } = GRID_CONFIG[context];
    return binPack(
      registry.filter((w) => w.defaultVisible),
      cols,
      [],
      maxRows,
    );
  }

  const knownIds = new Set(registry.map((w) => w.id));
  let result = stored.filter((s) => knownIds.has(s.widgetId));

  result = result.map((s) => {
    const def = registry.find((d) => d.id === s.widgetId)!;
    const variant = def.sizeVariants.find((v) => v.id === s.sizeVariantId);
    if (!variant) {
      const v = def.sizeVariants[0];
      return { ...s, sizeVariantId: v.id, w: v.w, h: v.h };
    }
    // Sincroniza w/h com a definição atual da variante (detecta mudanças de dimensões entre deploys).
    return { ...s, w: variant.w, h: variant.h };
  });

  // Auto-inserir widgets defaultVisible singletons ausentes (compat-forward).
  // Apenas singletons (instantiable !== true) — widgets instanciáveis não são auto-adicionados.
  // NOTA: compat-forward desativado — o layout salvo é a fonte da verdade.
  // Novos widgets adicionados ao registry NÃO são auto-inseridos em layouts existentes;
  // o usuário os adiciona manualmente pela paleta quando quiser.
  // Isso garante que remoções feitas pelo usuário sejam persistidas corretamente.

  return result;
}

// Resolve o renderMode da instância de um widget singleton no layout salvo.
// Reutilizável em qualquer dashboard client — evita duplicar o lookup nos clientes.
// Para widgets instanciáveis (instantiable: true), use a instância diretamente.
export function getRenderMode(
  widgets: StoredWidget[],
  context: DashboardContext,
  widgetId: string,
  fallback = "default",
): string {
  const inst = widgets.find((w) => w.widgetId === widgetId);
  return (
    WIDGET_REGISTRY[context]
      .find((d) => d.id === widgetId)
      ?.sizeVariants.find((v) => v.id === inst?.sizeVariantId)?.renderMode ?? fallback
  );
}
