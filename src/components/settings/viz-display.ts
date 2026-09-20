import type { WidgetDef } from "@/components/dashboards/_core/widget-registry";
import { resolveVizOptions, type ResolvedViz } from "@/components/dashboards/_core/widget-viz";
import { m } from "@/lib/messages";

// Rótulos das visualizações (Spec 69, 07b) para o editor de dashboard.
// Declarada → nome do frame (`…presentation.dashboards.viz`); derivada de uma
// `sizeVariant` → nome da variante (`…dashboards.variants`), que é como o
// usuário já vê aquele renderMode no bloco "Tamanho".

export function vizLabel(viz: ResolvedViz): string {
  if (viz.declared) {
    const labels = m.settings.presentation.dashboards.viz as Record<string, unknown>;
    const label = labels[viz.labelKey];
    if (typeof label === "string") return label;
  }
  const variants = m.settings.dashboards.variants as Record<string, string>;
  // `labelKey` primeiro (é o nome que o bloco "Tamanho" já usa); `key` (o
  // renderMode) como segunda tentativa. O fallback para a chave crua só apareceria
  // se um renderMode novo entrasse no registry sem rótulo em `variants`.
  return variants[viz.labelKey] ?? variants[viz.key] ?? viz.key;
}

export function vizLabelByKey(def: WidgetDef, key: string | null): string {
  if (!key) return "";
  const viz = resolveVizOptions(def).find((o) => o.key === key);
  return viz ? vizLabel(viz) : key;
}

/** "rosca · tabela" — o que o widget sabe desenhar, para o card da paleta (07c). */
export function vizSummary(def: WidgetDef): string {
  return resolveVizOptions(def).map(vizLabel).join(" · ");
}

/** "2, 3, 4 col" — larguras suportadas, para o card da paleta (07c). */
export function sizeSummary(def: WidgetDef): string {
  const widths = [...new Set(def.sizeVariants.map((v) => v.w))].sort((a, b) => a - b);
  return `${widths.join(", ")} ${m.settings.presentation.dashboards.inspector.sizeColumns}`;
}
