import { describe, expect, it } from "vitest";

import {
  canCommitItemDraft,
  itemOrderPatches,
  reorderItems,
  draftFromItem,
  EMPTY_ITEM_DRAFT,
  itemFromDraft,
  itemInputFromDraft,
  modelItemColumns,
  newItemFromDraft,
  normalizeDensity,
  normalizeRowLayout,
  sumItemCents,
  type ModelItem,
} from "./model-item-draft";

function buildItem(overrides: Partial<ModelItem> = {}): ModelItem {
  return {
    id: "item-1",
    day: 5,
    dayRule: "5",
    amountCents: "-5590",
    description: "Netflix",
    notes: null,
    isPending: false,
    categoryId: "cat-1",
    subcategoryId: null,
    institutionId: null,
    responsiblePartyId: "party-1",
    cardInstallment: null,
    investmentType: null,
    displayOrder: 0,
    ...overrides,
  };
}

describe("model-item-draft", () => {
  describe("draftFromItem", () => {
    it("traduz null para string vazia nos campos de seleção", () => {
      const draft = draftFromItem(buildItem({ categoryId: null, responsiblePartyId: null }));

      expect(draft.categoryId).toBe("");
      expect(draft.responsiblePartyId).toBe("");
    });

    it("item anterior à Spec 69 (sem dayRule) cai na coluna `day`", () => {
      const draft = draftFromItem(buildItem({ dayRule: null, day: 17 }));

      expect(draft.dayRule).toBe("17");
    });

    it("preserva o valor em centavos, sem passar por texto mascarado", () => {
      // O editor antigo guardava a string do campo e a reconvertia com
      // `replace(/\./g,"")` sobre um valor JÁ sem máscara — o que multiplicava
      // por 10 qualquer valor com centavos. Aqui não há reconversão nenhuma.
      expect(draftFromItem(buildItem({ amountCents: "-5590" })).amountCents).toBe("-5590");
    });
  });

  describe("canCommitItemDraft", () => {
    it("recusa a linha que não diz nada", () => {
      expect(canCommitItemDraft(EMPTY_ITEM_DRAFT)).toBe(false);
    });

    it("aceita valor 0,00 com descrição — é a linha 'criar em branco' da spec", () => {
      expect(canCommitItemDraft({ ...EMPTY_ITEM_DRAFT, description: "Seguro do carro" })).toBe(
        true,
      );
    });

    it("aceita valor sem descrição", () => {
      expect(canCommitItemDraft({ ...EMPTY_ITEM_DRAFT, amountCents: "-1000" })).toBe(true);
    });
  });

  describe("itemInputFromDraft", () => {
    it("manda null (e não undefined) no campo limpo — undefined manteria o valor antigo", () => {
      const draft = { ...draftFromItem(buildItem()), categoryId: "" };

      expect(itemInputFromDraft(draft).categoryId).toBeNull();
    });

    it("preserva a nota que veio do banco quando o usuário não a toca", () => {
      // `listTemplates` passou a selecionar `notes` (P7). O rascunho a carrega, e
      // o payload a devolve intacta — é isso que impede o update parcial de
      // apagar a nota de quem tem uma.
      const draft = draftFromItem(buildItem({ notes: "cobrança anual" }));

      expect(itemInputFromDraft(draft).notes).toBe("cobrança anual");
    });

    it("nota apagada pelo usuário vira null, não string vazia", () => {
      const draft = { ...draftFromItem(buildItem({ notes: "algo" })), notes: "   " };

      expect(itemInputFromDraft(draft).notes).toBeNull();
    });

    it("converte o valor para BigInt", () => {
      expect(itemInputFromDraft(draftFromItem(buildItem())).amountCents).toBe(-5590n);
    });
  });

  describe("itemFromDraft", () => {
    it("espelha `day` a partir da regra — 'último dia' ordena por último", () => {
      const base = buildItem();
      const updated = itemFromDraft(base, { ...draftFromItem(base), dayRule: "last" });

      expect(updated.dayRule).toBe("last");
      expect(updated.day).toBe(31);
    });

    it("'primeiro dia útil' espelha para o dia 1", () => {
      const base = buildItem();
      const updated = itemFromDraft(base, { ...draftFromItem(base), dayRule: "firstBusiness" });

      expect(updated.day).toBe(1);
    });

    it("dia fixo espelha o próprio número", () => {
      const base = buildItem();
      const updated = itemFromDraft(base, { ...draftFromItem(base), dayRule: "22" });

      expect(updated.day).toBe(22);
    });
  });

  describe("newItemFromDraft", () => {
    it("monta o item local a partir do rascunho, com o id do servidor", () => {
      const created = newItemFromDraft(
        "item-novo",
        { ...EMPTY_ITEM_DRAFT, description: "Seguro", dayRule: "last" },
        3,
      );

      expect(created).toMatchObject({
        id: "item-novo",
        description: "Seguro",
        dayRule: "last",
        day: 31,
        amountCents: "0",
        displayOrder: 3,
      });
    });
  });

  describe("modelItemColumns (D5)", () => {
    it("sem instituição no tipo, a coluna não entra", () => {
      expect(modelItemColumns(["occurredOn", "description", "category", "amount"])).toEqual([
        "occurredOn",
        "description",
        "category",
        "responsibleUser",
        "amount",
      ]);
    });

    it("com instituição no tipo, a coluna entra ANTES do valor", () => {
      const columns = modelItemColumns(["occurredOn", "description", "institution", "amount"]);

      expect(columns).toContain("institution");
      expect(columns.indexOf("institution")).toBeLessThan(columns.indexOf("amount"));
      expect(columns[columns.length - 1]).toBe("amount");
    });

    it("modelo sem tipo cai no conjunto base", () => {
      expect(modelItemColumns(undefined)).not.toContain("institution");
    });

    it("nenhuma coluna do tipo entra além das que o modelo sabe preencher", () => {
      // Um tipo com tags/método de pagamento não pode fazer o modelo ganhar
      // campos que ele não tem.
      const columns = modelItemColumns([
        "occurredOn",
        "description",
        "tags",
        "paymentMethod",
        "amount",
      ]);

      expect(columns).not.toContain("tags");
      expect(columns).not.toContain("paymentMethod");
    });
  });

  describe("sumItemCents", () => {
    it("soma em BigInt, sem passar por float", () => {
      expect(
        sumItemCents([
          buildItem({ amountCents: "-5590" }),
          buildItem({ amountCents: "-3490" }),
          buildItem({ amountCents: "0" }),
        ]),
      ).toBe(-9080n);
    });

    it("modelo vazio soma zero", () => {
      expect(sumItemCents([])).toBe(0n);
    });
  });

  describe("normalizadores da fronteira", () => {
    it("rowLayout desconhecido cai em colunas", () => {
      expect(normalizeRowLayout("pills")).toBe("pills");
      expect(normalizeRowLayout("rich")).toBe("columns");
      expect(normalizeRowLayout(null)).toBe("columns");
    });

    it("densidade desconhecida cai no padrão", () => {
      expect(normalizeDensity("compact")).toBe("compact");
      expect(normalizeDensity("gigante")).toBe("default");
      expect(normalizeDensity(null)).toBe("default");
    });
  });

  describe("reorderItems / itemOrderPatches (arraste)", () => {
    const items = [
      buildItem({ id: "a", displayOrder: 0 }),
      buildItem({ id: "b", displayOrder: 1 }),
      buildItem({ id: "c", displayOrder: 2 }),
    ];

    it("renumera de 0 a N−1 na ordem pedida", () => {
      const reordered = reorderItems(items, ["c", "a", "b"]);

      expect(reordered.map((i) => i.id)).toEqual(["c", "a", "b"]);
      expect(reordered.map((i) => i.displayOrder)).toEqual([0, 1, 2]);
    });

    it("nunca perde um item: id desconhecido é ignorado e o omitido vai para o fim", () => {
      const reordered = reorderItems(items, ["c", "fantasma"]);

      expect(reordered.map((i) => i.id)).toEqual(["c", "a", "b"]);
      expect(reordered).toHaveLength(3);
    });

    it("patch cobre TODAS as linhas deslocadas, não só a arrastada", () => {
      // Levar "c" para o topo empurra "a" e "b" — três escritas, não uma.
      expect(itemOrderPatches(items, ["c", "a", "b"])).toEqual([
        { itemId: "c", displayOrder: 0 },
        { itemId: "a", displayOrder: 1 },
        { itemId: "b", displayOrder: 2 },
      ]);
    });

    it("trocar duas vizinhas escreve só essas duas", () => {
      expect(itemOrderPatches(items, ["b", "a", "c"])).toEqual([
        { itemId: "b", displayOrder: 0 },
        { itemId: "a", displayOrder: 1 },
      ]);
    });

    it("ordem inalterada não gera escrita nenhuma", () => {
      expect(itemOrderPatches(items, ["a", "b", "c"])).toEqual([]);
    });
  });
});
