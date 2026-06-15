import { m } from "@/lib/messages";
import type { DashboardContext } from "@/components/dashboards/_core/widget-registry";

// Rótulo e descrição exibidos no editor de grade (canvas, paleta, painel de variantes).
// Fonte: m.dashboards.widgets[context] — mesma usada pelos próprios dashboards.

export function widgetLabel(context: DashboardContext, widgetId: string): string {
  const labels = m.dashboards.widgets[context] as Record<string, string>;
  return labels[widgetId] ?? widgetId;
}

export function widgetDescription(context: DashboardContext, widgetId: string): string {
  const descs = m.dashboards.widgets.descriptions[context] as Record<string, string>;
  return descs[widgetId] ?? "";
}
