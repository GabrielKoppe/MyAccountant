import { describe, expect, it } from "vitest";

import type { PreviewRow } from "@/lib/csv-parser";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

import { describeAliasImportApplication } from "./import-preview";

function baseParsed(
  overrides: Partial<NonNullable<PreviewRow["parsed"]>> = {},
): NonNullable<PreviewRow["parsed"]> {
  return {
    occurredOn: "2026-01-03",
    amountCents: 10000n,
    description: "pagamento CEG",
    notes: null,
    categoryName: null,
    subcategoryName: null,
    institutionName: null,
    cardInstallment: null,
    investmentType: null,
    responsibleUserId: null,
    originalAmountCents: null,
    originalCurrency: null,
    exchangeRate: null,
    appliedAliasId: "alias-1",
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
    triggerMode: "contains",
    priority: "medium",
    conditionInstitutionId: null,
    conditionInstitutionName: null,
    minCents: null,
    maxCents: null,
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

describe("describeAliasImportApplication", () => {
  it("não gera mudanças visíveis nem campos ocultos quando o apelido não define nada", () => {
    const result = describeAliasImportApplication(baseAlias(), baseParsed());
    expect(result.visibleChanges).toEqual([]);
    expect(result.hiddenFields).toEqual([]);
  });

  it("descrição e categoria entram como mudança visível (original → aplicado)", () => {
    const alias = baseAlias({
      description: "Sistema de Gás",
      categoryId: "cat-1",
      categoryName: "Conta",
    });
    const result = describeAliasImportApplication(
      alias,
      baseParsed({ categoryName: "Utilidades" }),
    );

    expect(result.visibleChanges).toEqual([
      { label: "Descrição", oldDisplay: "pagamento CEG", newDisplay: "Sistema de Gás" },
      { label: "Categoria", oldDisplay: "Utilidades", newDisplay: "Conta" },
    ]);
  });

  it("amountCents do apelido nunca aparece (DD-09 — import não aplica valor)", () => {
    const alias = baseAlias({ amountCents: "99999" });
    const result = describeAliasImportApplication(alias, baseParsed());

    expect(result.visibleChanges).toEqual([]);
    expect(result.hiddenFields).toEqual([]);
  });

  it("lista campos ocultos definidos pelo apelido (sem coluna própria no preview)", () => {
    const alias = baseAlias({
      notes: "nota",
      subcategoryId: "sub-1",
      subcategoryName: "Aluguel",
      institutionId: "inst-1",
      institutionName: "Banco X",
      responsiblePartyId: "party-1",
      responsiblePartyName: "Gabriel",
      expenseType: "fixed",
      paymentMethod: "pix",
      isPending: true,
      tags: [{ id: "tag-1", name: "Casa" }],
    });
    const result = describeAliasImportApplication(alias, baseParsed());

    expect(result.hiddenFields).toEqual([
      { label: "Notas", display: "nota" },
      { label: "Subcategoria", display: "Aluguel" },
      { label: "Instituição", display: "Banco X" },
      { label: "Responsável", display: "Gabriel" },
      { label: "Tipo de transação", display: "Transação fixa" },
      { label: "Método de pagamento", display: "PIX" },
      { label: "Pendente", display: "Pendente" },
      { label: "Tags", display: "Casa" },
    ]);
  });

  it("institutionText do apelido aparece como campo oculto de instituição", () => {
    const alias = baseAlias({ institutionText: "Corretora Y" });
    const result = describeAliasImportApplication(alias, baseParsed());

    expect(result.hiddenFields).toEqual([{ label: "Instituição", display: "Corretora Y" }]);
  });

  it("lista favorito e moeda estrangeira como campos ocultos (DD-21/DD-22)", () => {
    const alias = baseAlias({
      isFavorite: true,
      originalCurrency: "USD",
      originalAmountCents: "1299",
      exchangeRate: 5.12,
    });
    const result = describeAliasImportApplication(alias, baseParsed());

    expect(result.hiddenFields).toEqual([
      { label: "Favorito", display: "Favorito" },
      { label: "Moeda estrangeira", display: "USD · 12,99 · R$ 5,1200" },
    ]);
  });
});
