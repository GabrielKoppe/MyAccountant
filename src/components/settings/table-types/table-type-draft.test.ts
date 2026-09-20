import { describe, expect, it } from "vitest";

import {
  addColumn,
  availableColumns,
  buildUpdatePayload,
  countDirtyFields,
  draftFromType,
  prunePinned,
  removeColumn,
  toggleKey,
  type TableTypeDraft,
} from "./table-type-draft";

function buildDraft(overrides: Partial<TableTypeDraft> = {}): TableTypeDraft {
  return {
    name: "Cartão de crédito",
    rowLayout: "pills",
    density: "default",
    visibleColumns: ["occurredOn", "description", "category", "amount"],
    pinnedColumns: ["occurredOn"],
    inheritOnNewRow: ["occurredOn"],
    defaultSort: { key: "occurredOn", dir: "asc" },
    groupBy: null,
    showFooterTotal: true,
    showGroupSubtotal: false,
    allowBulkEdit: true,
    keepGhostRow: true,
    ...overrides,
  };
}

describe("table-type-draft", () => {
  describe("draftFromType", () => {
    it("copia as listas em vez de compartilhá-las", () => {
      const saved = buildDraft();
      const draft = draftFromType(saved);

      draft.visibleColumns.push("notes");
      draft.defaultSort.dir = "desc";

      expect(saved.visibleColumns).toEqual(["occurredOn", "description", "category", "amount"]);
      expect(saved.defaultSort.dir).toBe("asc");
    });
  });

  describe("countDirtyFields", () => {
    it("é zero quando nada mudou", () => {
      const saved = buildDraft();

      expect(countDirtyFields(draftFromType(saved), saved)).toBe(0);
    });

    it("ignora espaço em volta do nome", () => {
      const saved = buildDraft();

      expect(countDirtyFields(buildDraft({ name: "  Cartão de crédito  " }), saved)).toBe(0);
    });

    it("conta layout, densidade e agrupamento separadamente", () => {
      const saved = buildDraft();
      const draft = buildDraft({ rowLayout: "columns", density: "compact", groupBy: "date" });

      expect(countDirtyFields(draft, saved)).toBe(3);
    });

    it("REORDENAR colunas é alteração — a ordem é o dado (D3)", () => {
      const saved = buildDraft();
      const draft = buildDraft({
        visibleColumns: ["occurredOn", "category", "description", "amount"],
      });

      expect(countDirtyFields(draft, saved)).toBe(1);
    });

    it("uma reordenação inteira conta 1, não uma por coluna", () => {
      const saved = buildDraft();
      const draft = buildDraft({
        visibleColumns: ["amount", "category", "description", "occurredOn"],
      });

      expect(countDirtyFields(draft, saved)).toBe(1);
    });

    it("trocar chave e direção da ordenação conta 1 campo só", () => {
      const saved = buildDraft();
      const draft = buildDraft({ defaultSort: { key: "amount", dir: "desc" } });

      expect(countDirtyFields(draft, saved)).toBe(1);
    });
  });

  describe("buildUpdatePayload (§15 — `undefined` × `null`)", () => {
    it("update parcial menciona SÓ o campo alterado", () => {
      const saved = buildDraft();
      const payload = buildUpdatePayload("tt-1", buildDraft({ name: "Cartão" }), saved);

      expect(payload).toEqual({ tableTypeId: "tt-1", name: "Cartão" });
      // Tudo o que o usuário não tocou fica FORA — mencionar é reescrever.
      expect(payload).not.toHaveProperty("visibleColumns");
      expect(payload).not.toHaveProperty("groupBy");
      expect(payload).not.toHaveProperty("showFooterTotal");
      expect(payload).not.toHaveProperty("defaultSort");
    });

    it("nada mudou → o payload é só o id", () => {
      const saved = buildDraft();

      expect(buildUpdatePayload("tt-1", draftFromType(saved), saved)).toEqual({
        tableTypeId: "tt-1",
      });
    });

    it("limpar o agrupamento manda `null` explícito (é 'limpar', não 'não mencionei')", () => {
      const saved = buildDraft({ groupBy: "date" });
      const payload = buildUpdatePayload("tt-1", buildDraft({ groupBy: null }), saved);

      expect(payload).toHaveProperty("groupBy", null);
    });

    it("desligar um toggle manda `false` (e não some do payload)", () => {
      const saved = buildDraft();
      const payload = buildUpdatePayload("tt-1", buildDraft({ showFooterTotal: false }), saved);

      expect(payload).toHaveProperty("showFooterTotal", false);
    });

    it("no tipo padrão o conjunto de colunas NÃO vai no payload (o serviço o recusa)", () => {
      const saved = buildDraft();
      const draft = buildDraft({
        visibleColumns: ["occurredOn", "description", "amount"],
        density: "compact",
      });

      const payload = buildUpdatePayload("tt-1", draft, saved, { canEditColumns: false });

      expect(payload).not.toHaveProperty("visibleColumns");
      // Apresentação continua editável no tipo padrão.
      expect(payload).toHaveProperty("density", "compact");
    });
  });

  describe("colunas", () => {
    it("adicionar entra no FIM", () => {
      expect(addColumn(["occurredOn", "description", "amount"], "notes")).toEqual([
        "occurredOn",
        "description",
        "amount",
        "notes",
      ]);
    });

    it("adicionar duas vezes não duplica", () => {
      const once = addColumn(["occurredOn", "description", "amount"], "notes");

      expect(addColumn(once, "notes")).toEqual(once);
    });

    it("remover tira a coluna e preserva a ordem das outras", () => {
      expect(
        removeColumn(["occurredOn", "category", "description", "amount"], "category"),
      ).toEqual(["occurredOn", "description", "amount"]);
    });

    it("coluna obrigatória NÃO é removível — nem por chamada direta", () => {
      const visible = ["occurredOn", "description", "amount"] as const;

      expect(removeColumn(visible, "description")).toEqual([...visible]);
      expect(removeColumn(visible, "occurredOn")).toEqual([...visible]);
      expect(removeColumn(visible, "amount")).toEqual([...visible]);
    });

    it("Disponíveis = o complemento, na ordem canônica", () => {
      const available = availableColumns(["occurredOn", "description", "amount"]);

      expect(available).toContain("category");
      expect(available).not.toContain("description");
      // Ordem canônica de `TABLE_COLUMNS`: categoria antes de subcategoria.
      expect(available.indexOf("category")).toBeLessThan(available.indexOf("subcategory"));
    });
  });

  describe("toggleKey e prunePinned", () => {
    it("liga e desliga preservando a ordem dos demais", () => {
      expect(toggleKey(["a", "b"], "c")).toEqual(["a", "b", "c"]);
      expect(toggleKey(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    });

    it("coluna fixada que deixou de ser visível é desfixada", () => {
      expect(prunePinned(["occurredOn", "category"], ["occurredOn", "description", "amount"])).toEqual(
        ["occurredOn"],
      );
    });
  });
});
