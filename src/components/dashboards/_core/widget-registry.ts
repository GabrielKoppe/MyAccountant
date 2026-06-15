import type { z } from "zod";

import type { StoredWidget } from "@/lib/schemas/dashboard-layout";

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
  monthly: { cols: 6, initialRows: 10, maxRows: 12 },
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

// default 3×3, compact 2×2, large 4×3
const SQUARE_CHART_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 2, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 4, h: 3, renderMode: "full" },
];

// default 3×2, compact 2×2, large 4×3
const PIE_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 2, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 2, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 4, h: 3, renderMode: "full" },
];

const BUDGETS_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 2, renderMode: "default" },
  { id: "small", labelKey: "small", w: 2, h: 1, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 6, h: 3, renderMode: "full" },
];

const SECTION_CARDS_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 6, h: 1, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 1, renderMode: "compact" },
  { id: "expanded", labelKey: "expanded", w: 6, h: 2, renderMode: "expanded" },
];

const ACTIVITY_LISTS_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 6, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 6, h: 2, renderMode: "compact" },
];

const INSIGHTS_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 2, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 1, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 6, h: 3, renderMode: "expanded" },
];

const MONEY_FLOW_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 6, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 2, renderMode: "compact" },
];

const MONTH_CARD_GRID_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 6, h: 1, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 1, renderMode: "compact" },
  { id: "expanded", labelKey: "expanded", w: 6, h: 2, renderMode: "expanded" },
];

const MONTHLY_BAR_CHART_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 6, h: 2, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 3, h: 1, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 6, h: 3, renderMode: "expanded" },
];

const ANALYSIS_VARIANTS: WidgetSizeVariant[] = [
  { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default" },
  { id: "compact", labelKey: "compact", w: 2, h: 2, renderMode: "compact" },
  { id: "large", labelKey: "large", w: 6, h: 4, renderMode: "expanded" },
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
    },
    {
      id: "daily-heatmap",
      labelKey: "dailyHeatmap",
      kind: "panel",
      sizeVariants: SQUARE_CHART_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "category-treemap",
      labelKey: "categoryTreemap",
      kind: "panel",
      sizeVariants: SQUARE_CHART_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "money-flow",
      labelKey: "moneyFlow",
      kind: "panel",
      sizeVariants: MONEY_FLOW_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "section-breakdown",
      labelKey: "sectionBreakdown",
      kind: "panel",
      sizeVariants: PIE_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "category-breakdown",
      labelKey: "categoryBreakdown",
      kind: "panel",
      sizeVariants: PIE_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "top-transactions",
      labelKey: "topTransactions",
      kind: "panel",
      sizeVariants: WIDE_CHART_VARIANTS,
      defaultVisible: true,
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
      sizeVariants: WIDE_CHART_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "analysis",
      labelKey: "analysis",
      kind: "panel",
      sizeVariants: ANALYSIS_VARIANTS,
      defaultVisible: false,
      instantiable: true,
    },
    {
      id: "kpi-custom",
      labelKey: "kpiCustom",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: false,
      instantiable: true,
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
      sizeVariants: WIDE_CHART_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "member-trend",
      labelKey: "memberTrend",
      kind: "panel",
      sizeVariants: WIDE_CHART_VARIANTS,
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
    },
    {
      id: "kpi-custom",
      labelKey: "kpiCustom",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: false,
      instantiable: true,
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
      id: "activity-lists",
      labelKey: "activityLists",
      kind: "panel",
      sizeVariants: ACTIVITY_LISTS_VARIANTS,
      defaultVisible: true,
    },
    {
      id: "insights",
      labelKey: "insights",
      kind: "panel",
      sizeVariants: INSIGHTS_VARIANTS,
      defaultVisible: false,
    },
    {
      id: "kpi-custom",
      labelKey: "kpiCustom",
      kind: "kpi",
      sizeVariants: KPI_VARIANTS,
      defaultVisible: false,
      instantiable: true,
    },
    {
      id: "filtered-transactions",
      labelKey: "filteredTransactions",
      kind: "panel",
      sizeVariants: WIDE_CHART_VARIANTS,
      defaultVisible: false,
      instantiable: true,
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
function binPack(
  defs: WidgetDef[],
  cols: number,
  existingItems: StoredWidget[] = [],
): StoredWidget[] {
  const occ = buildOccupancy(existingItems);
  const result: StoredWidget[] = [];

  for (const def of defs) {
    const variant = def.sizeVariants[0];
    const w = Math.min(variant.w, cols);
    let placed = false;
    for (let y = 0; !placed; y++) {
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
  }

  return result;
}

// Reconcilia o layout salvo (StoredWidget[]) com o registry do contexto.
// - stored = null → layout inicial: bin-pack de todos os defaultVisible.
// - widgetId desconhecido → descartado silenciosamente.
// - sizeVariantId desconhecido → fallback para sizeVariants[0].
// - defaultVisible ausente no layout salvo → auto-inserido (compat-forward).
export function resolveLayout(
  context: DashboardContext,
  stored: StoredWidget[] | null,
): StoredWidget[] {
  const registry = WIDGET_REGISTRY[context];
  const { cols } = GRID_CONFIG[context];

  if (stored === null) {
    return binPack(
      registry.filter((w) => w.defaultVisible),
      cols,
    );
  }

  const knownIds = new Set(registry.map((w) => w.id));
  let result = stored.filter((s) => knownIds.has(s.widgetId));

  result = result.map((s) => {
    const def = registry.find((d) => d.id === s.widgetId)!;
    const variantExists = def.sizeVariants.some((v) => v.id === s.sizeVariantId);
    if (!variantExists) {
      const v = def.sizeVariants[0];
      return { ...s, sizeVariantId: v.id, w: v.w, h: v.h };
    }
    return s;
  });

  const present = new Set(result.map((s) => s.widgetId));
  const toAdd = registry.filter((d) => d.defaultVisible && !present.has(d.id));
  if (toAdd.length > 0) {
    result = [...result, ...binPack(toAdd, cols, result)];
  }

  return result;
}
