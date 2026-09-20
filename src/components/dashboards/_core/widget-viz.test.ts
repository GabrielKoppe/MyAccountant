import { describe, expect, it } from "vitest";

import { WIDGET_REGISTRY, type WidgetDef } from "./widget-registry";
import {
  configWithViz,
  currentVizKey,
  defaultVizKey,
  pickNearestValidViz,
  resolveVizOptions,
  variantForViz,
  vizAvailabilityAt,
  vizAxis,
  vizKeyForSizeVariantId,
  vizKeyForVariant,
} from "./widget-viz";

// ─────────────────────────────────────────────────────────────────────────────
// Spec 69 §8 — "pickNearestValidViz para todas as combinações da matriz 07b".
//
// A matriz 07b é normativa em 12 colunas; aqui ela vale convertida para as 6
// deste projeto (3→2, 4→2, 6→3, 8→4, 12→6 — ver o cabeçalho de widget-viz.ts).
// O `MATRIX_DEF` abaixo é a matriz inteira num único widget sintético, para
// varrer todas as combinações (6 visualizações × 5 larguras = 30 células).
// ─────────────────────────────────────────────────────────────────────────────

const MATRIX_DEF: WidgetDef = {
  id: "matrix",
  labelKey: "matrix",
  kind: "panel",
  defaultVisible: false,
  // Uma variante por visualização, na largura mínima dela — assim a regra da
  // geometria ("existe variante exatamente deste tamanho") também é exercitada.
  sizeVariants: [
    { id: "gauge", labelKey: "gauge", w: 2, h: 1, renderMode: "gauge" },
    { id: "bars", labelKey: "bars", w: 2, h: 2, renderMode: "bars" },
    { id: "donut", labelKey: "donut", w: 3, h: 2, renderMode: "donut" },
    { id: "table", labelKey: "table", w: 2, h: 3, renderMode: "rows" },
    // Duas larguras para a linha temporal: na mínima ela é a versão reduzida.
    { id: "line", labelKey: "line", w: 3, h: 3, renderMode: "line" },
    { id: "line-wide", labelKey: "line-wide", w: 4, h: 3, renderMode: "line" },
    { id: "heatmap", labelKey: "heatmap", w: 6, h: 3, renderMode: "heat" },
  ],
  viz: {
    gauge: { renderMode: "gauge", minCols: 2 },
    progressBars: { renderMode: "bars", minCols: 2 },
    donut: { renderMode: "donut", minCols: 3 },
    table: { renderMode: "rows", minCols: 2 },
    line: { renderMode: "line", minCols: 3, reduced: true },
    heatmap: { renderMode: "heat", minCols: 6 },
  },
  defaultViz: "donut",
};

/** A tabela 07b convertida: largura mínima de cada visualização nas 6 colunas. */
const MIN_COLS: Record<string, number> = {
  gauge: 2,
  progressBars: 2,
  donut: 3,
  table: 2,
  line: 3,
  heatmap: 6,
};

const WIDTHS = [2, 3, 4, 6];

describe("resolveVizOptions", () => {
  it("usa a matriz declarada quando existe", () => {
    const options = resolveVizOptions(MATRIX_DEF);
    expect(options.map((o) => o.key)).toEqual([
      "gauge",
      "progressBars",
      "donut",
      "table",
      "line",
      "heatmap",
    ]);
    expect(options.every((o) => o.declared)).toBe(true);
    expect(options.find((o) => o.key === "line")?.reduced).toBe(true);
  });

  it("deriva das sizeVariants quando o widget não declara viz — um renderMode, uma visualização", () => {
    const def: WidgetDef = {
      id: "single",
      labelKey: "single",
      kind: "panel",
      defaultVisible: false,
      sizeVariants: [
        { id: "default", labelKey: "default", w: 3, h: 2, renderMode: "default" },
        { id: "large", labelKey: "large", w: 6, h: 2, renderMode: "default" },
      ],
    };
    const options = resolveVizOptions(def);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ key: "default", minCols: 3, declared: false });
  });

  it("deriva uma visualização por renderMode distinto, com minCols na menor largura", () => {
    const def: WidgetDef = {
      id: "multi",
      labelKey: "multi",
      kind: "panel",
      defaultVisible: false,
      sizeVariants: [
        { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default" },
        { id: "compact", labelKey: "compact", w: 3, h: 2, renderMode: "compact" },
        { id: "large", labelKey: "large", w: 4, h: 3, renderMode: "expanded" },
      ],
    };
    expect(resolveVizOptions(def).map((o) => [o.key, o.minCols])).toEqual([
      ["default", 3],
      ["compact", 3],
      ["expanded", 4],
    ]);
  });

  it("KPI sem viz declarado é medidor único", () => {
    const def: WidgetDef = {
      id: "kpi",
      labelKey: "kpi",
      kind: "kpi",
      defaultVisible: false,
      sizeVariants: [
        { id: "default", labelKey: "default", w: 1, h: 1, renderMode: "default" },
        { id: "wide", labelKey: "wide", w: 2, h: 1, renderMode: "wide" },
      ],
    };
    const options = resolveVizOptions(def);
    expect(options).toHaveLength(1);
    expect(options[0].key).toBe("gauge");
    expect(options[0].minCols).toBe(1);
  });

  it("defaultVizKey respeita defaultViz e cai na primeira opção sem ele", () => {
    expect(defaultVizKey(MATRIX_DEF)).toBe("donut");
    expect(defaultVizKey({ ...MATRIX_DEF, defaultViz: undefined })).toBe("gauge");
  });
});

describe("pickNearestValidViz — matriz 07b completa", () => {
  // 6 visualizações × 4 larguras testadas = 24 combinações, cada uma partindo
  // da visualização em questão como "atual".
  for (const viz of Object.keys(MIN_COLS)) {
    for (const w of WIDTHS) {
      const fits = MIN_COLS[viz] <= w;
      it(`${viz} em ${w} col → ${fits ? "permanece" : "troca"}`, () => {
        // Altura fora de qualquer variante: força o caminho da matriz (regra 2),
        // sem a regra da geometria (regra 1) mascarar o resultado.
        const result = pickNearestValidViz(MATRIX_DEF, { w, h: 9 }, viz);
        if (fits) {
          expect(result).toEqual({ viz, changed: false, reason: null });
        } else {
          expect(result.changed).toBe(true);
          expect(result.reason).toBe("size");
          expect(result.viz).not.toBe(viz);
          // A substituta tem de caber na largura pedida.
          expect(MIN_COLS[result.viz!]).toBeLessThanOrEqual(w);
        }
      });
    }
  }

  it("escolhe a válida mais próxima (a mais rica que ainda cabe)", () => {
    // heatmap (6) não cabe em 4 → sobram gauge/bars/table (2) e donut/line (3);
    // a mais rica que cabe é a de maior minCols, desempatando pela ordem declarada.
    expect(pickNearestValidViz(MATRIX_DEF, { w: 4, h: 9 }, "heatmap").viz).toBe("donut");
    // Em 2 col só sobram as de minCols 2 — vence a primeira declarada.
    expect(pickNearestValidViz(MATRIX_DEF, { w: 2, h: 9 }, "heatmap").viz).toBe("gauge");
  });

  it("a geometria manda: existindo variante exatamente do tamanho, vale o renderMode dela", () => {
    // 3×2 é a variante `donut`, mesmo vindo de uma visualização que caberia.
    expect(pickNearestValidViz(MATRIX_DEF, { w: 3, h: 2 }, "table")).toEqual({
      viz: "donut",
      changed: true,
      reason: "size",
    });
    // Sem troca quando a visualização da variante já é a atual.
    expect(pickNearestValidViz(MATRIX_DEF, { w: 3, h: 2 }, "donut").changed).toBe(false);
  });

  it("sem visualização atual não reporta troca", () => {
    const result = pickNearestValidViz(MATRIX_DEF, { w: 2, h: 9 }, null);
    expect(result.changed).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("widget sem variantes devolve nulo em vez de estourar", () => {
    const empty: WidgetDef = {
      id: "empty",
      labelKey: "empty",
      kind: "panel",
      defaultVisible: false,
      sizeVariants: [],
    };
    expect(pickNearestValidViz(empty, { w: 3, h: 2 }, null)).toEqual({
      viz: null,
      changed: false,
      reason: null,
    });
  });

  it("widget derivado troca de visualização ao encolher abaixo da variante", () => {
    const def: WidgetDef = {
      id: "multi",
      labelKey: "multi",
      kind: "panel",
      defaultVisible: false,
      sizeVariants: [
        { id: "default", labelKey: "default", w: 3, h: 3, renderMode: "default" },
        { id: "compact", labelKey: "compact", w: 3, h: 2, renderMode: "compact" },
        { id: "large", labelKey: "large", w: 4, h: 3, renderMode: "expanded" },
      ],
    };
    expect(pickNearestValidViz(def, { w: 3, h: 3 }, "expanded")).toEqual({
      viz: "default",
      changed: true,
      reason: "size",
    });
  });
});

describe("vizKeyForVariant", () => {
  it("casa pelo renderMode quando ele tem entrada própria", () => {
    const variant = MATRIX_DEF.sizeVariants.find((v) => v.id === "line")!;
    expect(vizKeyForVariant(MATRIX_DEF, variant)).toBe("line");
  });

  it("renderMode sem entrada herda a visualização mais rica que cabe na largura", () => {
    // PIE_VARIANTS: `compact` (2×2) e `large` (4×4) não têm entrada própria —
    // ambos continuam sendo a rosca declarada. (`member-breakdown` ficou no eixo
    // variante, ver o comentário no registry.)
    const pie = WIDGET_REGISTRY.monthly.find((d) => d.id === "member-breakdown")!;
    for (const variant of pie.sizeVariants) {
      expect(vizKeyForVariant(pie, variant)).toBe("donut");
    }
  });

  it("resolve a partir do sizeVariantId salvo, com fallback para a variante default", () => {
    const pie = WIDGET_REGISTRY.monthly.find((d) => d.id === "member-breakdown")!;
    expect(vizKeyForSizeVariantId(pie, "large")).toBe("donut");
    expect(vizKeyForSizeVariantId(pie, "inexistente")).toBe("donut");
  });
});

describe("variantForViz", () => {
  it("escolhe a variante mais próxima do tamanho atual entre as que produzem a visualização", () => {
    const pie = WIDGET_REGISTRY.monthly.find((d) => d.id === "member-breakdown")!;
    // Todas as variantes do pie são rosca → mantém o tamanho atual.
    expect(variantForViz(pie, "donut", { w: 4, h: 4 })?.id).toBe("large");
    expect(variantForViz(pie, "donut", { w: 2, h: 2 })?.id).toBe("compact");
  });

  it("devolve null quando nenhuma variante produz a visualização", () => {
    expect(variantForViz(MATRIX_DEF, "inexistente", { w: 3, h: 2 })).toBeNull();
  });
});

describe("vizAvailabilityAt — os três estados do 07b", () => {
  it("aceita · aceita com dados reduzidos · indisponível com motivo", () => {
    // Tamanho real de uma variante (3×2 = a rosca) — é sempre assim que a UI chama.
    const states = vizAvailabilityAt(MATRIX_DEF, { w: 3, h: 2 });
    const byKey = new Map(states.map((s) => [s.viz.key, s]));

    expect(byKey.get("donut")?.state).toBe("ok");
    // linha temporal na largura mínima → dados reduzidos (o ⚠ do frame).
    expect(byKey.get("line")?.state).toBe("reduced");
    // mapa de calor precisa de 6 colunas → indisponível, com o motivo visível.
    expect(byKey.get("heatmap")).toMatchObject({
      state: "unavailable",
      reason: { kind: "needsColumns", cols: 6 },
    });
    // medidor cabe em 3 col, mas só existe em 2×1 — o motivo diz para onde ir.
    expect(byKey.get("gauge")).toMatchObject({
      state: "unavailable",
      reason: { kind: "onlyAtSize", size: "2×1" },
    });
  });

  it("acima da largura mínima a visualização reduzida passa a plena", () => {
    const netWorth = WIDGET_REGISTRY.yearly.find((d) => d.id === "net-worth-evolution")!;
    expect(vizAvailabilityAt(netWorth, { w: 3, h: 2 })[0].state).toBe("reduced");
    expect(vizAvailabilityAt(netWorth, { w: 6, h: 2 })[0].state).toBe("ok");
  });

  it('visualização de tamanho único fora dele é indisponível com "só em WxH"', () => {
    const def: WidgetDef = {
      id: "gauge-only",
      labelKey: "gauge-only",
      kind: "panel",
      defaultVisible: false,
      sizeVariants: [
        { id: "gauge", labelKey: "gauge", w: 3, h: 1, renderMode: "gauge" },
        { id: "table", labelKey: "table", w: 3, h: 3, renderMode: "rows" },
      ],
      viz: {
        gauge: { renderMode: "gauge", minCols: 3 },
        table: { renderMode: "rows", minCols: 3 },
      },
    };
    const states = vizAvailabilityAt(def, { w: 3, h: 3 });
    expect(states.find((s) => s.viz.key === "gauge")).toMatchObject({
      state: "unavailable",
      reason: { kind: "onlyAtSize", size: "3×1" },
    });
    expect(states.find((s) => s.viz.key === "table")?.state).toBe("ok");
  });
});

describe("eixo config — quem troca o desenho é config.chartType", () => {
  const pie = WIDGET_REGISTRY.monthly.find((d) => d.id === "category-breakdown")!;

  it("o widget declara o eixo config", () => {
    expect(vizAxis(pie)).toBe("config");
    expect(vizAxis(WIDGET_REGISTRY.monthly.find((d) => d.id === "top-transactions")!)).toBe(
      "variant",
    );
  });

  it("a visualização atual vem do config, não da variante", () => {
    expect(currentVizKey(pie, { sizeVariantId: "default" })).toBe("donut"); // defaultConfig
    expect(currentVizKey(pie, { sizeVariantId: "default", config: { chartType: "bar" } })).toBe(
      "bars",
    );
    // Mesma variante, config diferente → visualização diferente.
    expect(currentVizKey(pie, { sizeVariantId: "compact", config: { chartType: "pie" } })).toBe(
      "donut",
    );
  });

  it("escolher a visualização grava chartType preservando o resto do config", () => {
    const config = { chartType: "pie", filterTagIds: ["t1"], filterExpenseType: "fixed" };
    expect(configWithViz(pie, config, "bars")).toEqual({
      chartType: "bar",
      filterTagIds: ["t1"],
      filterExpenseType: "fixed",
    });
  });

  it("sem config, parte do defaultConfig do widget", () => {
    expect(configWithViz(pie, undefined, "bars")).toMatchObject({
      chartType: "bar",
      filterTagIds: [],
    });
  });

  it("no eixo variante, configWithViz não mexe no config", () => {
    const topTx = WIDGET_REGISTRY.monthly.find((d) => d.id === "top-transactions")!;
    expect(configWithViz(topTx, { limit: 10 }, "table")).toEqual({ limit: 10 });
  });

  it("encolher abaixo do mínimo da rosca troca para barras e avisa", () => {
    // 2 col não comporta a rosca (minCols 3) → barras (minCols 2).
    expect(pickNearestValidViz(pie, { w: 2, h: 2 }, "donut")).toEqual({
      viz: "bars",
      changed: true,
      reason: "size",
    });
    // A geometria NÃO manda aqui: em 3×3 as barras continuam válidas.
    expect(pickNearestValidViz(pie, { w: 3, h: 3 }, "bars").changed).toBe(false);
  });

  it("no eixo config o motivo é sempre a largura, nunca um tamanho exato", () => {
    const states = vizAvailabilityAt(pie, { w: 2, h: 2 });
    expect(states.find((s) => s.viz.key === "donut")).toMatchObject({
      state: "unavailable",
      reason: { kind: "needsColumns", cols: 3 },
    });
    expect(states.find((s) => s.viz.key === "bars")?.state).toBe("ok");
    expect(vizAvailabilityAt(pie, { w: 3, h: 3 }).every((s) => s.state === "ok")).toBe(true);
  });
});

describe("registro real — invariantes da matriz", () => {
  const allDefs = [
    ...WIDGET_REGISTRY.monthly,
    ...WIDGET_REGISTRY.yearly,
    ...WIDGET_REGISTRY.month_summary,
  ];

  it("toda visualização declarada é alcançável por alguma variante", () => {
    for (const def of allDefs) {
      if (!def.viz) continue;
      const reachable = new Set(def.sizeVariants.map((v) => vizKeyForVariant(def, v)));
      for (const key of Object.keys(def.viz)) {
        expect(
          reachable.has(key),
          `${def.id}: visualização "${key}" não é produzida por nenhuma variante`,
        ).toBe(true);
      }
    }
  });

  it("toda variante resolve para alguma visualização", () => {
    for (const def of allDefs) {
      for (const variant of def.sizeVariants) {
        expect(vizKeyForVariant(def, variant), `${def.id}/${variant.id}`).not.toBeNull();
      }
    }
  });

  it("todo widget tem grupo de paleta declarado", () => {
    for (const def of allDefs) {
      expect(def.group, `${def.id} sem group`).toBeDefined();
    }
  });
});
