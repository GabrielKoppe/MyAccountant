/**
 * Tipo "de apresentação" de cada widget — usado na pill do editor de grade.
 * Diferente de `WidgetDef.kind` (kpi | panel, que controla layout): aqui é a
 * categoria de conteúdo (KPI, gráfico, tabela, painel) exibida ao usuário.
 * Mapa por widgetId, no mesmo padrão de `WIDGET_ICONS`.
 */
export type WidgetTypeKey = "kpi" | "chart" | "table" | "panel";

export const WIDGET_TYPE: Record<string, WidgetTypeKey> = {
  // KPIs
  "kpi-month-total": "kpi",
  "kpi-income": "kpi",
  "kpi-expenses": "kpi",
  "kpi-savings-rate": "kpi",
  "kpi-top-category": "kpi",
  "kpi-pending": "kpi",
  "kpi-year-total": "kpi",
  "kpi-monthly-avg": "kpi",
  "kpi-best-month": "kpi",
  "kpi-worst-month": "kpi",
  "kpi-balance": "kpi",
  "kpi-custom": "kpi",

  // Gráficos
  "daily-heatmap": "chart",
  "category-treemap": "chart",
  "money-flow": "chart",
  "section-breakdown": "chart",
  "category-breakdown": "chart",
  "member-breakdown": "chart",
  "monthly-bar-chart": "chart",
  "top-categories": "chart",
  "member-trend": "chart",
  analysis: "chart",

  // Tabelas / listas
  "top-transactions": "table",
  "activity-lists": "table",
  "filtered-transactions": "table",

  // Painéis
  budgets: "panel",
  insights: "panel",
  "month-card-grid": "panel",
  "section-cards": "panel",
  checklist: "panel",

  // Spec 38
  "kpi-budget-health": "kpi",
  "kpi-transaction-count": "kpi",
  "institution-breakdown": "chart",
  "week-chart": "chart",
  "member-yearly": "chart",
};
