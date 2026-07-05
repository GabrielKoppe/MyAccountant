import { describe, expect, it } from "vitest";

import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import { GRID_CONFIG, resolveLayout, WIDGET_REGISTRY } from "./widget-registry";

// ─── resolveLayout — bin-packing (casos de borda) ────────────────

describe("binPack — casos de borda", () => {
  it("KPIs consecutivos ficam na primeira linha quando há espaço", () => {
    const result = resolveLayout("monthly", null);
    // Cruzar StoredWidget com o registry para obter o kind
    const kpiWidgetIds = new Set(
      WIDGET_REGISTRY.monthly.filter((d) => d.kind === "kpi" && d.defaultVisible).map((d) => d.id),
    );
    const kpis = result.filter((w) => kpiWidgetIds.has(w.widgetId));
    // monthly tem 6 KPIs defaultVisible (w:1, h:1) — todos devem caber na linha y=0
    expect(kpis.length).toBe(6);
    const firstRowKpis = kpis.filter((w) => w.y === 0);
    expect(firstRowKpis.length).toBe(6);
  });

  it("widget que não cabe na linha atual avança para a próxima", () => {
    const result = resolveLayout("monthly", null);
    const { cols } = GRID_CONFIG["monthly"];
    result.forEach((w) => {
      expect(w.x + w.w).toBeLessThanOrEqual(cols);
    });
  });

  it("stored = [] respeita escolha do usuário (sem widgets no dashboard)", () => {
    const result = resolveLayout("monthly", []);
    // stored vazio = usuário removeu todos — layout respeitado integralmente
    expect(result).toHaveLength(0);
  });

  it("widgets com visible: false são preservados no resultado", () => {
    const ghost: StoredWidget = {
      instanceId: "ghost-1",
      widgetId: "kpi-income",
      visible: false,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      sizeVariantId: "default",
    };
    const result = resolveLayout("monthly", [ghost]);
    const found = result.find((w) => w.instanceId === "ghost-1");
    expect(found?.visible).toBe(false);
  });

  it("layout inicial (stored=null) posiciona somente widgets defaultVisible", () => {
    const result = resolveLayout("monthly", null);
    const defaultVisibleIds = new Set(
      WIDGET_REGISTRY.monthly.filter((d) => d.defaultVisible).map((d) => d.id),
    );
    // Todos os widgets do resultado devem ser defaultVisible
    result.forEach((w) => {
      expect(defaultVisibleIds.has(w.widgetId)).toBe(true);
    });
  });

  it("instâncias têm instanceId === widgetId no layout inicial (singletons)", () => {
    const result = resolveLayout("monthly", null);
    result.forEach((w) => {
      expect(w.instanceId).toBe(w.widgetId);
    });
  });

  it("checklist é exclusivo do month_summary (regressão — spec 36)", () => {
    expect(WIDGET_REGISTRY.month_summary.find((w) => w.id === "checklist")).toBeDefined();
    expect(WIDGET_REGISTRY.monthly.find((w) => w.id === "checklist")).toBeUndefined();
    expect(WIDGET_REGISTRY.yearly.find((w) => w.id === "checklist")).toBeUndefined();
  });

  it("todos os widgets do layout inicial têm visible: true", () => {
    const result = resolveLayout("monthly", null);
    result.forEach((w) => {
      expect(w.visible).toBe(true);
    });
  });

  it("widgets salvo com sizeVariantId desconhecido fazem fallback para sizeVariants[0]", () => {
    const stored: StoredWidget[] = [
      {
        instanceId: "i1",
        widgetId: "budgets",
        visible: true,
        x: 0,
        y: 0,
        w: 3,
        h: 2,
        sizeVariantId: "variante-inexistente",
      },
    ];
    const result = resolveLayout("monthly", stored);
    const budgets = result.find((w) => w.widgetId === "budgets");
    // sizeVariants[0] de budgets = 'default' (w:3, h:2)
    expect(budgets?.sizeVariantId).toBe("default");
    expect(budgets?.w).toBe(3);
    expect(budgets?.h).toBe(2);
  });

  it("widgetId desconhecido no stored é descartado silenciosamente", () => {
    const stored: StoredWidget[] = [
      {
        instanceId: "orphan",
        widgetId: "widget-que-nao-existe-mais",
        visible: true,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        sizeVariantId: "default",
      },
    ];
    const result = resolveLayout("monthly", stored);
    expect(result.every((w) => w.widgetId !== "widget-que-nao-existe-mais")).toBe(true);
  });

  it("layout yearly tem widgets corretos no layout inicial", () => {
    const result = resolveLayout("yearly", null);
    const ids = result.map((w) => w.widgetId);
    // Widgets defaultVisible do yearly
    expect(ids).toContain("kpi-year-total");
    expect(ids).toContain("kpi-income");
    expect(ids).toContain("month-card-grid");
    // Widgets que NÃO pertencem ao yearly
    expect(ids).not.toContain("kpi-month-total");
    expect(ids).not.toContain("daily-heatmap");
  });

  it("layout month_summary tem widgets corretos no layout inicial", () => {
    const result = resolveLayout("month_summary", null);
    const ids = result.map((w) => w.widgetId);
    expect(ids).toContain("kpi-income");
    expect(ids).toContain("kpi-expenses");
    expect(ids).toContain("kpi-balance");
    expect(ids).toContain("section-cards");
    // Não deve conter widgets de outros contextos
    expect(ids).not.toContain("kpi-month-total");
    expect(ids).not.toContain("daily-heatmap");
  });
});
