import { describe, expect, it } from "vitest";

import type { CategoryOption } from "@/components/transactions/types";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

import {
  type AliasApplicableFields,
  type AliasPatch,
  aliasPatchToUpdateInput,
  computeAliasApplication,
} from "./apply";

const CATEGORIES: CategoryOption[] = [
  {
    id: "cat-conta",
    name: "Conta",
    subcategories: [
      { id: "sub-gas", name: "Gás" },
      { id: "sub-luz", name: "Luz" },
    ],
  },
  {
    id: "cat-lazer",
    name: "Lazer",
    subcategories: [{ id: "sub-cinema", name: "Cinema" }],
  },
];

const SOURCES = { categories: CATEGORIES, institutions: [], parties: [] };

function baseCurrent(overrides: Partial<AliasApplicableFields> = {}): AliasApplicableFields {
  return {
    description: null,
    notes: null,
    amountCents: "0",
    categoryId: null,
    subcategoryId: null,
    institutionId: null,
    responsiblePartyId: null,
    expenseType: null,
    paymentMethod: null,
    isPending: false,
    ...overrides,
  };
}

function baseAlias(
  overrides: Partial<SerializedTransactionAlias> = {},
): SerializedTransactionAlias {
  return {
    id: "alias-1",
    trigger: "CEG",
    triggerNormalized: "ceg",
    updatedAt: "2026-01-01T00:00:00.000Z",
    description: null,
    notes: null,
    amountCents: null,
    categoryId: null,
    categoryName: null,
    subcategoryId: null,
    subcategoryName: null,
    institutionId: null,
    institutionName: null,
    institutionText: null,
    responsiblePartyId: null,
    responsiblePartyName: null,
    expenseType: null,
    paymentMethod: null,
    investmentType: null,
    cardInstallment: null,
    isPending: null,
    isFavorite: null,
    originalCurrency: null,
    originalAmountCents: null,
    exchangeRate: null,
    isArchived: false,
    createdById: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    tags: [],
    ...overrides,
  };
}

describe("computeAliasApplication", () => {
  it("não gera patch/changes quando o apelido não define nada", () => {
    const { patch, changes } = computeAliasApplication(baseAlias(), baseCurrent(), SOURCES);
    expect(patch).toEqual({});
    expect(changes).toEqual([]);
  });

  it("não gera change quando o valor do apelido já é igual ao atual", () => {
    const alias = baseAlias({ categoryId: "cat-conta" });
    const current = baseCurrent({ categoryId: "cat-conta" });
    const { patch, changes } = computeAliasApplication(alias, current, SOURCES);
    expect(patch.categoryId).toBeUndefined();
    expect(changes).toEqual([]);
  });

  it("descrição e notas: define patch e change quando diferem", () => {
    const alias = baseAlias({ description: "Sistema de Gás", notes: "conta mensal" });
    const { patch, changes } = computeAliasApplication(alias, baseCurrent(), SOURCES);
    expect(patch.description).toBe("Sistema de Gás");
    expect(patch.notes).toBe("conta mensal");
    expect(changes.map((c) => c.field)).toEqual(["description", "notes"]);
  });

  it("amountCents: aplica verbatim, sem inversão de sinal (DD-20)", () => {
    const alias = baseAlias({ amountCents: "-12345" });
    const { patch, changes } = computeAliasApplication(
      alias,
      baseCurrent({ amountCents: "500" }),
      SOURCES,
    );
    expect(patch.amountCents).toBe("-12345");
    const change = changes.find((c) => c.field === "amountCents");
    expect(change?.newDisplay).toContain("-");
  });

  it("categoria: troca de categoria mantém subcategoria que ainda é filha", () => {
    const alias = baseAlias({ categoryId: "cat-conta" });
    const current = baseCurrent({ categoryId: "cat-conta", subcategoryId: "sub-gas" });
    const { patch, changes } = computeAliasApplication(alias, current, SOURCES);
    // categoria já é a mesma — nada muda, subcategoria não é tocada
    expect(patch.categoryId).toBeUndefined();
    expect(patch.subcategoryId).toBeUndefined();
    expect(changes).toEqual([]);
  });

  it("categoria (DD-18): troca de categoria limpa subcategoria órfã", () => {
    const alias = baseAlias({ categoryId: "cat-lazer" });
    const current = baseCurrent({ categoryId: "cat-conta", subcategoryId: "sub-gas" });
    const { patch, changes } = computeAliasApplication(alias, current, SOURCES);
    expect(patch.categoryId).toBe("cat-lazer");
    expect(patch.subcategoryId).toBeNull();
    const subChange = changes.find((c) => c.field === "subcategoryId");
    expect(subChange?.newDisplay).toBe("—");
  });

  it("categoria (DD-18): troca de categoria preserva subcategoria explícita do apelido", () => {
    const alias = baseAlias({ categoryId: "cat-lazer", subcategoryId: "sub-cinema" });
    const current = baseCurrent({ categoryId: "cat-conta", subcategoryId: "sub-gas" });
    const { patch } = computeAliasApplication(alias, current, SOURCES);
    expect(patch.categoryId).toBe("cat-lazer");
    expect(patch.subcategoryId).toBe("sub-cinema");
  });

  it("expenseType/paymentMethod/isPending: define patch e change quando diferem", () => {
    const alias = baseAlias({ expenseType: "fixed", paymentMethod: "pix", isPending: true });
    const { patch, changes } = computeAliasApplication(alias, baseCurrent(), SOURCES);
    expect(patch.expenseType).toBe("fixed");
    expect(patch.paymentMethod).toBe("pix");
    expect(patch.isPending).toBe(true);
    expect(changes).toHaveLength(3);
  });

  it("institutionId/responsiblePartyId: define patch quando diferem", () => {
    const alias = baseAlias({ institutionId: "inst-1", responsiblePartyId: "party-1" });
    const { patch } = computeAliasApplication(alias, baseCurrent(), SOURCES);
    expect(patch.institutionId).toBe("inst-1");
    expect(patch.responsiblePartyId).toBe("party-1");
  });
});

describe("aliasPatchToUpdateInput (aplicação em modo visualização — DD-23)", () => {
  it("patch vazio → input vazio", () => {
    expect(aliasPatchToUpdateInput({})).toEqual({});
  });

  it("amountCents (string no TransactionRow) vira BigInt", () => {
    const out = aliasPatchToUpdateInput({ amountCents: "12345" });
    expect(out.amountCents).toBe(12345n);
    expect(typeof out.amountCents).toBe("bigint");
  });

  it("passa os demais campos verbatim, incluindo null", () => {
    const patch: AliasPatch = {
      description: "Sistema de Gás",
      notes: null,
      categoryId: "cat-conta",
      subcategoryId: null, // limpeza de órfã (DD-18) precisa chegar como null
      institutionId: "inst-1",
      responsiblePartyId: "party-1",
      expenseType: "fixed",
      paymentMethod: "pix",
      isPending: true,
    };
    expect(aliasPatchToUpdateInput(patch)).toEqual({
      description: "Sistema de Gás",
      notes: null,
      categoryId: "cat-conta",
      subcategoryId: null,
      institutionId: "inst-1",
      responsiblePartyId: "party-1",
      expenseType: "fixed",
      paymentMethod: "pix",
      isPending: true,
    });
  });

  it("só inclui as chaves presentes (patch parcial, DD-04)", () => {
    const out = aliasPatchToUpdateInput({ categoryId: "cat-conta" });
    expect(Object.keys(out)).toEqual(["categoryId"]);
    expect("amountCents" in out).toBe(false);
  });
});
