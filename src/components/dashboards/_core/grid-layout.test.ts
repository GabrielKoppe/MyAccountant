import { describe, expect, it } from "vitest";

import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { WidgetSizeVariant } from "./widget-registry";
import {
  applyMoveWithPush,
  applyResizeWithPush,
  findFreeCell,
  insertWithPush,
  rectsOverlap,
  snapToNearestVariant,
} from "./grid-layout";

function w(overrides: Partial<StoredWidget> & { instanceId: string }): StoredWidget {
  return {
    widgetId: overrides.widgetId ?? "kpi-income",
    visible: true,
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    sizeVariantId: "default",
    ...overrides,
  };
}

describe("rectsOverlap", () => {
  it("detecta sobreposição", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(true);
  });

  it("retângulos adjacentes não se sobrepõem", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(false);
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 0, y: 2, w: 2, h: 2 })).toBe(false);
  });
});

describe("applyMoveWithPush", () => {
  it("empurra para baixo o widget sobreposto pela nova posição", () => {
    const widgets = [w({ instanceId: "a", x: 0, y: 0 }), w({ instanceId: "b", x: 0, y: 1 })];
    const result = applyMoveWithPush(widgets, "a", 0, 1, 12);
    expect(result).not.toBeNull();
    const b = result!.find((it) => it.instanceId === "b")!;
    // 'a' fica em y:1; 'b' (1×1) é empurrado para y:2
    expect(b.y).toBe(2);
  });

  it("retorna null quando o push ultrapassa maxRows", () => {
    const widgets = [
      w({ instanceId: "a", x: 0, y: 0, h: 1 }),
      w({ instanceId: "b", x: 0, y: 1, h: 1 }),
    ];
    // maxRows=2: mover 'a' para y:1 empurra 'b' para y:2 (2+1 > 2) → inválido
    expect(applyMoveWithPush(widgets, "a", 0, 1, 2)).toBeNull();
  });

  it("retorna null para instanceId inexistente", () => {
    expect(applyMoveWithPush([w({ instanceId: "a" })], "x", 0, 0, 12)).toBeNull();
  });
});

describe("insertWithPush", () => {
  it("insere e empurra os existentes para baixo", () => {
    const widgets = [w({ instanceId: "a", x: 0, y: 0, w: 2, h: 2 })];
    const novo = w({ instanceId: "new", x: 0, y: 0, w: 2, h: 2 });
    const result = insertWithPush(widgets, novo, 12);
    expect(result).not.toBeNull();
    const a = result!.find((it) => it.instanceId === "a")!;
    expect(a.y).toBe(2);
  });

  it("retorna null quando não cabe dentro de maxRows", () => {
    const widgets = [w({ instanceId: "a", x: 0, y: 0, h: 2 })];
    const novo = w({ instanceId: "new", x: 0, y: 0, h: 2 });
    // novo em y:0 empurra 'a' para y:2 (2+2 > 3) → inválido
    expect(insertWithPush(widgets, novo, 3)).toBeNull();
  });
});

describe("applyResizeWithPush", () => {
  it("aplica novo tamanho e empurra sobrepostos", () => {
    const widgets = [
      w({ instanceId: "a", x: 0, y: 0, w: 1, h: 1 }),
      w({ instanceId: "b", x: 0, y: 1, w: 1, h: 1 }),
    ];
    const result = applyResizeWithPush(widgets, "a", 2, 2, "large", 6, 12);
    expect(result).not.toBeNull();
    const a = result!.find((it) => it.instanceId === "a")!;
    expect(a.w).toBe(2);
    expect(a.h).toBe(2);
    expect(a.sizeVariantId).toBe("large");
    // 'b' (em y:1) é empurrado para y:2 pelo novo footprint 2×2
    expect(result!.find((it) => it.instanceId === "b")!.y).toBe(2);
  });

  it("desloca o widget para a esquerda ao crescer perto da borda", () => {
    // card em x:3, w:3 (ocupa 3..5); crescer para w:6 não cabe em x:3 →
    // desloca para x:0 em vez de falhar.
    const widgets = [w({ instanceId: "a", x: 3, y: 0, w: 3, h: 2 })];
    const result = applyResizeWithPush(widgets, "a", 6, 3, "large", 6, 12);
    expect(result).not.toBeNull();
    const a = result!.find((it) => it.instanceId === "a")!;
    expect(a.x).toBe(0);
    expect(a.w).toBe(6);
    expect(a.h).toBe(3);
  });
});

describe("findFreeCell", () => {
  it("retorna a primeira célula livre (linha por linha)", () => {
    const widgets = [w({ instanceId: "a", x: 0, y: 0, w: 2, h: 1 })];
    expect(findFreeCell(widgets, 1, 1, 6, 12)).toEqual({ x: 2, y: 0 });
  });

  it("avança para a próxima linha quando a primeira está cheia", () => {
    const widgets = [w({ instanceId: "a", x: 0, y: 0, w: 6, h: 1 })];
    expect(findFreeCell(widgets, 1, 1, 6, 12)).toEqual({ x: 0, y: 1 });
  });

  it("retorna null quando não há espaço dentro de maxRows", () => {
    const widgets = [w({ instanceId: "a", x: 0, y: 0, w: 6, h: 2 })];
    expect(findFreeCell(widgets, 1, 1, 6, 2)).toBeNull();
  });
});

describe("snapToNearestVariant", () => {
  const variants: WidgetSizeVariant[] = [
    { id: "default", labelKey: "default", w: 6, h: 2, renderMode: "default" },
    { id: "compact", labelKey: "compact", w: 3, h: 2, renderMode: "compact" },
    { id: "large", labelKey: "large", w: 6, h: 3, renderMode: "expanded" },
  ];

  it("escolhe a variante mais próxima por distância de Manhattan", () => {
    expect(snapToNearestVariant(3, 2, variants).id).toBe("compact");
    expect(snapToNearestVariant(6, 3, variants).id).toBe("large");
    expect(snapToNearestVariant(5, 2, variants).id).toBe("default");
  });

  it("empate resolve para a variante declarada primeiro", () => {
    // (4,3): compact (3×2) dist=2 e large (6×3) dist=2 empatam →
    // vence compact, declarada antes (sizeVariants[0] é a default).
    expect(snapToNearestVariant(4, 3, variants).id).toBe("compact");
  });
});
