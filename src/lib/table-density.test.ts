import { describe, expect, it } from "vitest";

import {
  DEFAULT_DENSITY,
  DENSITIES,
  DENSITY_CSS_VAR,
  DENSITY_METRICS,
  DENSITY_VAR,
  densityCssVars,
  densityGlobalStyles,
  parseDensity,
} from "./table-density";

// Spec 69 §8 (Unit): "Mapa `density` → variáveis CSS (3 níveis, 3 vars)".
describe("table-density", () => {
  describe("DENSITY_METRICS", () => {
    it("reproduz os valores normativos do frame 05 nos 3 níveis", () => {
      expect(DENSITY_METRICS).toEqual({
        compact: { rowHeight: "36px", fontSize: "0.78rem", controlHeight: "26px" },
        default: { rowHeight: "44px", fontSize: "0.8125rem", controlHeight: "28px" },
        comfortable: { rowHeight: "52px", fontSize: "0.8125rem", controlHeight: "30px" },
      });
    });

    it("cobre exatamente as densidades declaradas", () => {
      expect(Object.keys(DENSITY_METRICS).sort()).toEqual([...DENSITIES].sort());
    });
  });

  describe("densityCssVars", () => {
    it.each([
      ["compact", { "--row-h": "36px", "--row-fs": "0.78rem", "--ctrl-h": "26px" }],
      ["default", { "--row-h": "44px", "--row-fs": "0.8125rem", "--ctrl-h": "28px" }],
      ["comfortable", { "--row-h": "52px", "--row-fs": "0.8125rem", "--ctrl-h": "30px" }],
    ] as const)("mapeia %s para as 3 variáveis", (density, expected) => {
      expect(densityCssVars(density)).toEqual(expected);
    });

    it("emite sempre as 3 variáveis, nunca mais nem menos", () => {
      for (const density of DENSITIES) {
        expect(Object.keys(densityCssVars(density))).toEqual([
          DENSITY_CSS_VAR.rowHeight,
          DENSITY_CSS_VAR.fontSize,
          DENSITY_CSS_VAR.controlHeight,
        ]);
      }
    });
  });

  describe("densityGlobalStyles", () => {
    it("declara um bloco [data-density] por nível, com as 3 variáveis", () => {
      const styles = densityGlobalStyles();
      expect(Object.keys(styles)).toEqual([
        '[data-density="compact"]',
        '[data-density="default"]',
        '[data-density="comfortable"]',
      ]);
      // `comfortable` é CLONE EXATO da tabela ANTES da Spec 69 (52,5px / 13px /
      // 30px medidos no navegador em 2026-08-11) — inclusive a fonte.
      expect(styles['[data-density="comfortable"]']).toEqual({
        "--row-h": "52px",
        "--row-fs": "0.8125rem",
        "--ctrl-h": "30px",
      });
    });
  });

  describe("DENSITY_VAR", () => {
    it("expõe os nomes de variável com fallback para os valores de default", () => {
      expect(DENSITY_VAR).toEqual({
        rowHeight: "var(--row-h, 44px)",
        fontSize: "var(--row-fs, 0.8125rem)",
        controlHeight: "var(--ctrl-h, 28px)",
      });
    });
  });

  describe("parseDensity", () => {
    it.each(DENSITIES)("aceita %s", (density) => {
      expect(parseDensity(density)).toBe(density);
    });

    it.each([
      ["desconhecida", "cozy"],
      ["string vazia", ""],
      ["caixa diferente", "Compact"],
      ["null", null],
      ["undefined", undefined],
      ["número", 44],
      ["objeto", { density: "compact" }],
      ["array", ["compact"]],
    ])("cai em default para %s", (_label, raw) => {
      expect(parseDensity(raw)).toBe(DEFAULT_DENSITY);
    });

    it("default é 'default'", () => {
      expect(DEFAULT_DENSITY).toBe("default");
    });
  });
});
