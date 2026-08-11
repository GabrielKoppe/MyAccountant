import { describe, expect, it } from "vitest";

import {
  filterCategoryTree,
  getVisibleCategories,
  sortCategoryTree,
  type CategoryItem,
} from "./categories-tree";

function sub(
  id: string,
  name: string,
  overrides: Partial<CategoryItem["subcategories"][number]> = {},
) {
  return { id, name, order: 0, status: "active" as const, lastUsedAt: null, ...overrides };
}

function category(id: string, name: string, overrides: Partial<CategoryItem> = {}): CategoryItem {
  return {
    id,
    name,
    order: 0,
    status: "active",
    lastUsedAt: null,
    subcategories: [],
    ...overrides,
  };
}

describe("filterCategoryTree", () => {
  describe("busca (Spec 68 §4)", () => {
    it("categoria que casa pelo nome mantém TODAS as subcategorias", () => {
      const tree = [
        category("c1", "Alimentação", {
          subcategories: [sub("s1", "Mercado"), sub("s2", "Restaurante")],
        }),
      ];
      const result = filterCategoryTree(tree, { query: "aliment" });
      expect(result).toHaveLength(1);
      expect(result[0].subcategories).toHaveLength(2);
    });

    it("subcategoria que casa PUXA o pai para o resultado mesmo que o nome do pai não bata", () => {
      const tree = [
        category("c1", "Alimentação", {
          subcategories: [sub("s1", "Mercado"), sub("s2", "Restaurante")],
        }),
        category("c2", "Moradia", { subcategories: [sub("s3", "Aluguel")] }),
      ];
      const result = filterCategoryTree(tree, { query: "restaurante" });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c1");
      // Só a subcategoria que casou aparece — não a árvore inteira do pai.
      expect(result[0].subcategories.map((s) => s.id)).toEqual(["s2"]);
    });

    it("categoria sem nenhuma correspondência (nem pai nem filhos) some do resultado", () => {
      const tree = [
        category("c1", "Alimentação", { subcategories: [sub("s1", "Mercado")] }),
        category("c2", "Moradia", { subcategories: [sub("s2", "Aluguel")] }),
      ];
      const result = filterCategoryTree(tree, { query: "transporte" });
      expect(result).toEqual([]);
    });

    it("é insensível a acento e caixa", () => {
      const tree = [category("c1", "Educação")];
      expect(filterCategoryTree(tree, { query: "EDUCACAO" })).toHaveLength(1);
    });

    it("query vazia devolve a árvore inteira sem alterar subcategorias", () => {
      const tree = [category("c1", "Alimentação", { subcategories: [sub("s1", "Mercado")] })];
      const result = filterCategoryTree(tree, { query: "   " });
      expect(result).toEqual(tree);
    });
  });
});

describe("sortCategoryTree", () => {
  it("manual: ordena por `order`, nos dois níveis da árvore", () => {
    const tree = [
      category("c2", "B", { order: 1 }),
      category("c1", "A", {
        order: 0,
        subcategories: [sub("s2", "b", { order: 1 }), sub("s1", "a", { order: 0 })],
      }),
    ];
    const result = sortCategoryTree(tree, "manual");
    expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(result[0].subcategories.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("alfabética: ordena por nome (pt-BR, acentos incluídos)", () => {
    const tree = [category("c1", "Transporte"), category("c2", "Alimentação")];
    const result = sortCategoryTree(tree, "alphabetical");
    expect(result.map((c) => c.name)).toEqual(["Alimentação", "Transporte"]);
  });

  describe("usadas recentemente", () => {
    it("ordena por lastUsedAt desc", () => {
      const tree = [
        category("c1", "Antiga", { lastUsedAt: "2026-01-01T00:00:00.000Z" }),
        category("c2", "Recente", { lastUsedAt: "2026-07-01T00:00:00.000Z" }),
      ];
      const result = sortCategoryTree(tree, "recent");
      expect(result.map((c) => c.id)).toEqual(["c2", "c1"]);
    });

    it("null (nunca usada) SEMPRE vai para o fim, mesmo entre datas antigas", () => {
      const tree = [
        category("c1", "Nunca usada", { lastUsedAt: null }),
        category("c2", "Usada em 2020", { lastUsedAt: "2020-01-01T00:00:00.000Z" }),
        category("c3", "Usada em 2026", { lastUsedAt: "2026-01-01T00:00:00.000Z" }),
      ];
      const result = sortCategoryTree(tree, "recent");
      expect(result.map((c) => c.id)).toEqual(["c3", "c2", "c1"]);
    });

    it("aceita Date e string ISO misturados no mesmo comparador", () => {
      const tree = [
        category("c1", "Data", { lastUsedAt: new Date("2026-01-01T00:00:00.000Z") }),
        category("c2", "String", { lastUsedAt: "2026-06-01T00:00:00.000Z" }),
      ];
      const result = sortCategoryTree(tree, "recent");
      expect(result.map((c) => c.id)).toEqual(["c2", "c1"]);
    });
  });
});

describe("getVisibleCategories", () => {
  it("compõe filtro e ordenação numa chamada só", () => {
    const tree = [category("c1", "Zebra", { order: 1 }), category("c2", "Abacaxi", { order: 0 })];
    const result = getVisibleCategories(tree, { query: "" }, "alphabetical");
    expect(result.map((c) => c.id)).toEqual(["c2", "c1"]);
  });
});
