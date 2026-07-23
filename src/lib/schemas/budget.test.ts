import { describe, expect, it } from "vitest";

import { createBudgetSchema } from "./budget";

const sectionId = "cljk3d4e500002abcdefgh5678";
const categoryId = "cljk3d4e500003abcdefgh9012";
const categoryId2 = "cljk3d4e500007abcdefgh3344";
const memberUserId = "cljk3d4e500004abcdefgh3456";
const institutionId = "cljk3d4e500005abcdefgh7890";
const tableTypeId = "cljk3d4e500006abcdefgh1122";

// Payload base recorrente e válido; sobrescreva só a dimensão sob teste.
const base = {
  name: "",
  amountCents: 120000n,
  alertThresholdPercent: 80,
  isRecurring: true,
  showInSummary: false,
  year: null,
  month: null,
};

describe("createBudgetSchema — dimensões como arrays", () => {
  it("aceita uma dimensão (array de 1) por vez", () => {
    for (const dim of [
      { sectionIds: [sectionId] },
      { categoryIds: [categoryId] },
      { memberUserIds: [memberUserId] },
      { institutionIds: [institutionId] },
      { tableTypeIds: [tableTypeId] },
    ]) {
      expect(createBudgetSchema.safeParse({ ...base, ...dim }).success).toBe(true);
    }
  });

  it("aceita múltiplos ids na mesma dimensão", () => {
    const result = createBudgetSchema.safeParse({
      ...base,
      categoryIds: [categoryId, categoryId2],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.categoryIds).toEqual([categoryId, categoryId2]);
  });

  it("aceita combinação de dimensões distintas (interseção): categoria + instituição", () => {
    const result = createBudgetSchema.safeParse({
      ...base,
      categoryIds: [categoryId],
      institutionIds: [institutionId],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita quando nenhuma dimensão é informada", () => {
    expect(createBudgetSchema.safeParse(base).success).toBe(false);
  });

  it("default []: chaves ausentes/undefined viram array vazio", () => {
    const result = createBudgetSchema.safeParse({ ...base, sectionIds: [sectionId] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categoryIds).toEqual([]);
      expect(result.data.memberUserIds).toEqual([]);
      expect(result.data.institutionIds).toEqual([]);
      expect(result.data.tableTypeIds).toEqual([]);
    }
  });
});

describe("createBudgetSchema — normalização (regressão do bug 'ID inválido')", () => {
  it('remove "" e valores falsy das dimensões', () => {
    const result = createBudgetSchema.safeParse({
      ...base,
      sectionIds: [sectionId, "", ""],
      categoryIds: [""],
      memberUserIds: [""],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sectionIds).toEqual([sectionId]);
      expect(result.data.categoryIds).toEqual([]);
      expect(result.data.memberUserIds).toEqual([]);
    }
  });

  it("remove ids duplicados", () => {
    const result = createBudgetSchema.safeParse({
      ...base,
      categoryIds: [categoryId, categoryId, categoryId2],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.categoryIds).toEqual([categoryId, categoryId2]);
  });

  it('trata todas as dimensões "" como ausência total (nenhuma dimensão)', () => {
    const result = createBudgetSchema.safeParse({
      ...base,
      sectionIds: [""],
      categoryIds: [""],
      memberUserIds: [""],
      institutionIds: [""],
      tableTypeIds: [""],
    });
    expect(result.success).toBe(false);
  });

  it("continua rejeitando um id não-vazio malformado", () => {
    expect(createBudgetSchema.safeParse({ ...base, categoryIds: ["abc"] }).success).toBe(false);
  });
});

describe("createBudgetSchema — conflitos de dimensão", () => {
  it("rejeita seção + categoria combinadas", () => {
    const result = createBudgetSchema.safeParse({
      ...base,
      sectionIds: [sectionId],
      categoryIds: [categoryId],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("categoryIds"))).toBe(true);
    }
  });

  it("rejeita seção + tipo de tabela combinados", () => {
    const result = createBudgetSchema.safeParse({
      ...base,
      sectionIds: [sectionId],
      tableTypeIds: [tableTypeId],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("tableTypeIds"))).toBe(true);
    }
  });
});
