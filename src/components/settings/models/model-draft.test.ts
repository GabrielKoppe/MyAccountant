import { describe, expect, it } from "vitest";

import {
  automationSiblings,
  buildSectionOrder,
  clampInsertionIndex,
  countDirtyFields,
  draftFromModel,
  orderPatches,
  sortAutomationMembers,
  type ModelDraftSource,
} from "./model-draft";

function buildModel(overrides: Partial<ModelDraftSource> = {}): ModelDraftSource {
  return {
    id: "tpl-1",
    name: "Cartão Nubank",
    tableTypeId: "tt-card",
    autoApply: false,
    autoSectionId: null,
    orderInSection: null,
    ...overrides,
  };
}

describe("model-draft", () => {
  describe("draftFromModel", () => {
    it("traduz null para string vazia nos selects", () => {
      const draft = draftFromModel(buildModel({ tableTypeId: null, autoSectionId: null }));

      expect(draft.tableTypeId).toBe("");
      expect(draft.autoSectionId).toBe("");
      // `orderInSection` NÃO vira 0: `null` significa "no fim", 0 significa "primeiro".
      expect(draft.orderInSection).toBeNull();
    });
  });

  describe("countDirtyFields", () => {
    it("é zero para um rascunho recém-derivado do modelo", () => {
      const model = buildModel();

      expect(countDirtyFields(draftFromModel(model), model)).toBe(0);
    });

    it("conta nome e tipo de tabela", () => {
      const model = buildModel();
      const draft = { ...draftFromModel(model), name: "Cartão Itaú", tableTypeId: "tt-other" };

      expect(countDirtyFields(draft, model)).toBe(2);
    });

    it("ignora espaço em volta do nome", () => {
      const model = buildModel();
      const draft = { ...draftFromModel(model), name: "  Cartão Nubank  " };

      expect(countDirtyFields(draft, model)).toBe(0);
    });

    it("conta o toggle de automação", () => {
      const model = buildModel({ autoApply: false });
      const draft = { ...draftFromModel(model), autoApply: true };

      expect(countDirtyFields(draft, model)).toBe(1);
    });

    it("com a automação DESLIGADA, seção e ordem escondidas não contam", () => {
      const model = buildModel({ autoApply: false, autoSectionId: "sec-1", orderInSection: 0 });
      const draft = {
        ...draftFromModel(model),
        autoSectionId: "sec-2",
        orderInSection: 3,
      };

      // Os dois campos divergem, mas estão fora da tela — contá-los faria o rodapé
      // apontar para alterações que o usuário não consegue ver nem revisar.
      expect(countDirtyFields(draft, model)).toBe(0);
    });

    it("com a automação LIGADA, seção e ordem contam", () => {
      const model = buildModel({ autoApply: true, autoSectionId: "sec-1", orderInSection: 0 });
      const draft = { ...draftFromModel(model), autoSectionId: "sec-2", orderInSection: 1 };

      expect(countDirtyFields(draft, model)).toBe(2);
    });
  });

  describe("sortAutomationMembers", () => {
    it("ordena por orderInSection e joga os sem ordem para o fim", () => {
      const sorted = sortAutomationMembers([
        { id: "c", name: "Cartão C", orderInSection: null },
        { id: "a", name: "Cartão A", orderInSection: 1 },
        { id: "b", name: "Cartão B", orderInSection: 0 },
      ]);

      expect(sorted.map((s) => s.id)).toEqual(["b", "a", "c"]);
    });

    it("desempata por nome — dois modelos podem compartilhar a mesma ordem gravada", () => {
      const sorted = sortAutomationMembers([
        { id: "z", name: "Zebra", orderInSection: 0 },
        { id: "a", name: "Abelha", orderInSection: 0 },
      ]);

      expect(sorted.map((s) => s.id)).toEqual(["a", "z"]);
    });
  });

  describe("automationSiblings", () => {
    const models = [
      { id: "self", name: "Eu", orderInSection: 0, autoApply: true, autoSectionId: "sec-1" },
      { id: "other", name: "Outro", orderInSection: 1, autoApply: true, autoSectionId: "sec-1" },
      {
        id: "manual",
        name: "Manual",
        orderInSection: null,
        autoApply: false,
        autoSectionId: "sec-1",
      },
      { id: "far", name: "Longe", orderInSection: 0, autoApply: true, autoSectionId: "sec-2" },
    ];

    it("traz só os automáticos da MESMA seção, sem o próprio", () => {
      expect(automationSiblings(models, "self", "sec-1").map((s) => s.id)).toEqual(["other"]);
    });

    it("sem seção escolhida não há irmão (e o campo Ordem não aparece)", () => {
      expect(automationSiblings(models, "self", "")).toEqual([]);
    });
  });

  describe("clampInsertionIndex", () => {
    it("null é o fim da fila", () => {
      expect(clampInsertionIndex(null, 2)).toBe(2);
    });

    it("recorta valores fora da faixa (ordem gravada de uma seção anterior)", () => {
      expect(clampInsertionIndex(9, 2)).toBe(2);
      expect(clampInsertionIndex(-3, 2)).toBe(0);
    });
  });

  describe("buildSectionOrder", () => {
    const siblings = [
      { id: "a", name: "A", orderInSection: 0 },
      { id: "b", name: "B", orderInSection: 1 },
    ];

    it("encaixa o modelo editado na posição pedida", () => {
      expect(buildSectionOrder(siblings, "self", 0)).toEqual(["self", "a", "b"]);
      expect(buildSectionOrder(siblings, "self", 1)).toEqual(["a", "self", "b"]);
    });

    it("null põe no fim", () => {
      expect(buildSectionOrder(siblings, "self", null)).toEqual(["a", "b", "self"]);
    });
  });

  describe("orderPatches", () => {
    it("devolve só quem mudou de posição", () => {
      const stored = new Map<string, number | null>([
        ["a", 0],
        ["b", 1],
        ["self", null],
      ]);

      expect(orderPatches(["self", "a", "b"], stored)).toEqual([
        { templateId: "self", orderInSection: 0 },
        { templateId: "a", orderInSection: 1 },
        { templateId: "b", orderInSection: 2 },
      ]);
    });

    it("fila já correta não gera escrita nenhuma", () => {
      const stored = new Map<string, number | null>([
        ["a", 0],
        ["b", 1],
      ]);

      expect(orderPatches(["a", "b"], stored)).toEqual([]);
    });
  });
});
