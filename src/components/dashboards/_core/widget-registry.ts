export type WidgetKind = "kpi" | "panel";
export type WidgetSpan = "half" | "full";
export type DashboardContext = "monthly" | "yearly" | "month_summary";

export type WidgetDef = {
  id: string;
  labelKey: string;
  kind: WidgetKind;
  span?: WidgetSpan;
  defaultVisible: boolean;
};

export type ResolvedLayout = {
  active: WidgetDef[];
  available: WidgetDef[];
};

export type Segment =
  | { type: "kpis"; widgets: WidgetDef[] }
  | { type: "halves"; widgets: [WidgetDef] | [WidgetDef, WidgetDef] }
  | { type: "full"; widget: WidgetDef };

export function buildSegments(active: WidgetDef[]): Segment[] {
  const segments: Segment[] = [];
  let i = 0;

  while (i < active.length) {
    const w = active[i];

    if (w.kind === "kpi") {
      const group: WidgetDef[] = [w];
      while (i + 1 < active.length && active[i + 1].kind === "kpi") {
        i++;
        group.push(active[i]);
      }
      segments.push({ type: "kpis", widgets: group });
      i++;
      continue;
    }

    if (w.span === "half") {
      if (i + 1 < active.length && active[i + 1].span === "half") {
        segments.push({ type: "halves", widgets: [w, active[i + 1]] });
        i += 2;
      } else {
        segments.push({ type: "halves", widgets: [w] });
        i++;
      }
      continue;
    }

    segments.push({ type: "full", widget: w });
    i++;
  }

  return segments;
}

export const WIDGET_REGISTRY: Record<DashboardContext, WidgetDef[]> = {
  monthly: [
    { id: "kpi-month-total", labelKey: "monthTotal", kind: "kpi", defaultVisible: true },
    { id: "kpi-income", labelKey: "income", kind: "kpi", defaultVisible: true },
    { id: "kpi-expenses", labelKey: "expenses", kind: "kpi", defaultVisible: true },
    { id: "kpi-savings-rate", labelKey: "savingsRate", kind: "kpi", defaultVisible: true },
    { id: "kpi-top-category", labelKey: "topCategory", kind: "kpi", defaultVisible: true },
    { id: "kpi-pending", labelKey: "pending", kind: "kpi", defaultVisible: true },
    { id: "budgets", labelKey: "budgets", kind: "panel", span: "full", defaultVisible: true },
    {
      id: "daily-heatmap",
      labelKey: "dailyHeatmap",
      kind: "panel",
      span: "half",
      defaultVisible: true,
    },
    {
      id: "category-treemap",
      labelKey: "categoryTreemap",
      kind: "panel",
      span: "half",
      defaultVisible: true,
    },
    { id: "money-flow", labelKey: "moneyFlow", kind: "panel", span: "full", defaultVisible: true },
    {
      id: "section-breakdown",
      labelKey: "sectionBreakdown",
      kind: "panel",
      span: "half",
      defaultVisible: true,
    },
    {
      id: "category-breakdown",
      labelKey: "categoryBreakdown",
      kind: "panel",
      span: "half",
      defaultVisible: true,
    },
    {
      id: "pinned-analyses",
      labelKey: "pinnedAnalyses",
      kind: "panel",
      span: "full",
      defaultVisible: true,
    },
    {
      id: "top-transactions",
      labelKey: "topTransactions",
      kind: "panel",
      span: "full",
      defaultVisible: true,
    },
    { id: "insights", labelKey: "insights", kind: "panel", span: "full", defaultVisible: false },
    {
      id: "member-breakdown",
      labelKey: "memberBreakdown",
      kind: "panel",
      span: "full",
      defaultVisible: false,
    },
  ],
  yearly: [
    { id: "kpi-year-total", labelKey: "yearTotal", kind: "kpi", defaultVisible: true },
    { id: "kpi-income", labelKey: "income", kind: "kpi", defaultVisible: true },
    { id: "kpi-expenses", labelKey: "expenses", kind: "kpi", defaultVisible: true },
    { id: "kpi-savings-rate", labelKey: "savingsRate", kind: "kpi", defaultVisible: true },
    { id: "kpi-monthly-avg", labelKey: "monthlyAvg", kind: "kpi", defaultVisible: true },
    { id: "kpi-best-month", labelKey: "bestMonth", kind: "kpi", defaultVisible: true },
    { id: "kpi-worst-month", labelKey: "worstMonth", kind: "kpi", defaultVisible: true },
    { id: "kpi-pending", labelKey: "pending", kind: "kpi", defaultVisible: true },
    {
      id: "month-card-grid",
      labelKey: "monthCardGrid",
      kind: "panel",
      span: "full",
      defaultVisible: true,
    },
    {
      id: "monthly-bar-chart",
      labelKey: "monthlyBarChart",
      kind: "panel",
      span: "full",
      defaultVisible: true,
    },
    {
      id: "pinned-analyses",
      labelKey: "pinnedAnalyses",
      kind: "panel",
      span: "full",
      defaultVisible: true,
    },
    {
      id: "top-categories",
      labelKey: "topCategories",
      kind: "panel",
      span: "full",
      defaultVisible: true,
    },
    {
      id: "member-trend",
      labelKey: "memberTrend",
      kind: "panel",
      span: "full",
      defaultVisible: false,
    },
  ],
  month_summary: [
    { id: "kpi-income", labelKey: "income", kind: "kpi", defaultVisible: true },
    { id: "kpi-expenses", labelKey: "expenses", kind: "kpi", defaultVisible: true },
    { id: "kpi-balance", labelKey: "balance", kind: "kpi", defaultVisible: true },
    { id: "budgets", labelKey: "budgets", kind: "panel", span: "full", defaultVisible: true },
    {
      id: "section-cards",
      labelKey: "sectionCards",
      kind: "panel",
      span: "full",
      defaultVisible: true,
    },
    {
      id: "activity-lists",
      labelKey: "activityLists",
      kind: "panel",
      span: "full",
      defaultVisible: true,
    },
    { id: "insights", labelKey: "insights", kind: "panel", span: "full", defaultVisible: false },
  ],
};

// Reconcilia layout salvo com o registry.
// stored = null  → primeira visita, usa todos os defaultVisible na ordem do registry.
// stored = []    → usuário removeu tudo, respeitamos a escolha.
// stored = [...]  → respeitamos exatamente a ordem e seleção do usuário;
//                   IDs desconhecidos são descartados silenciosamente.
export function resolveLayout(context: DashboardContext, stored: string[] | null): ResolvedLayout {
  const registry = WIDGET_REGISTRY[context];
  const byId = new Map(registry.map((w) => [w.id, w]));
  const active: WidgetDef[] = [];
  const seen = new Set<string>();

  if (stored === null) {
    for (const def of registry) {
      if (def.defaultVisible) {
        active.push(def);
        seen.add(def.id);
      }
    }
  } else {
    for (const id of stored) {
      const def = byId.get(id);
      if (!def || seen.has(id)) continue;
      seen.add(id);
      active.push(def);
    }
  }

  const activeIds = new Set(active.map((w) => w.id));
  const available = registry.filter((w) => !activeIds.has(w.id));

  return { active, available };
}
