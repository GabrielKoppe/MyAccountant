import { describe, expect, it } from "vitest";

import { CSV_BOM } from "@/lib/export-utils";

import { buildCategoriesExportCsv, buildCategoriesExportJson } from "./categories-export";
import type { CategoryItem } from "./categories-tree";

function buildCategory(overrides: Partial<CategoryItem> = {}): CategoryItem {
  return {
    id: "cat-1",
    name: "Alimentação",
    order: 0,
    status: "active",
    lastUsedAt: null,
    subcategories: [],
    ...overrides,
  };
}

describe("buildCategoriesExportCsv", () => {
  it("gera o cabeçalho nome/pai — sem seção nem cor (Category.defaultSectionId abandonado)", () => {
    const csv = buildCategoriesExportCsv([]);
    expect(csv).toBe(`${CSV_BOM}nome,pai`);
  });

  it("categoria de topo: pai vazio", () => {
    const csv = buildCategoriesExportCsv([buildCategory({ name: "Aluguel" })]);
    const lines = csv.replace(CSV_BOM, "").split("\r\n");
    expect(lines).toEqual(["nome,pai", "Aluguel,"]);
  });

  it("subcategoria: pai é o nome da categoria", () => {
    const csv = buildCategoriesExportCsv([
      buildCategory({
        name: "Moradia",
        subcategories: [
          { id: "sub-1", name: "Aluguel", order: 0, status: "active", lastUsedAt: null },
          { id: "sub-2", name: "Condomínio", order: 1, status: "active", lastUsedAt: null },
        ],
      }),
    ]);
    const lines = csv.replace(CSV_BOM, "").split("\r\n");
    expect(lines).toEqual(["nome,pai", "Moradia,", "Aluguel,Moradia", "Condomínio,Moradia"]);
  });

  it("escapa nomes com vírgula", () => {
    const csv = buildCategoriesExportCsv([buildCategory({ name: "Casa, carro e afins" })]);
    expect(csv).toContain('"Casa, carro e afins",');
  });
});

describe("buildCategoriesExportJson", () => {
  it("gera um array vazio para nenhuma categoria", () => {
    expect(buildCategoriesExportJson([])).toBe("[]");
  });

  it("categoria de topo: `pai` nulo", () => {
    const json = buildCategoriesExportJson([buildCategory({ name: "Aluguel" })]);
    expect(JSON.parse(json)).toEqual([{ nome: "Aluguel", pai: null }]);
  });

  it("subcategoria: `pai` é o nome da categoria — mesma forma aceita de volta pelo import", () => {
    const json = buildCategoriesExportJson([
      buildCategory({
        name: "Moradia",
        subcategories: [
          { id: "sub-1", name: "Aluguel", order: 0, status: "active", lastUsedAt: null },
        ],
      }),
    ]);
    expect(JSON.parse(json)).toEqual([
      { nome: "Moradia", pai: null },
      { nome: "Aluguel", pai: "Moradia" },
    ]);
  });
});
