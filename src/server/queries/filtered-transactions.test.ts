import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import type { FilteredTransactionsConfig } from "@/lib/schemas/widget-config";

import { prismaMock } from "../../../tests/mocks/prisma";
import { getFilteredTransactions } from "./filtered-transactions";

// Mock isolado: testamos a construção do `where` de filtered-transactions.ts, não a
// lógica interna de responsiblePartyIdsForFilter (já coberta em responsible-party-filter.test.ts).
vi.mock("./responsible-party-filter", () => ({
  responsiblePartyIdsForFilter: vi.fn(),
}));

import { responsiblePartyIdsForFilter } from "./responsible-party-filter";

function baseConfig(
  overrides: Partial<FilteredTransactionsConfig> = {},
): FilteredTransactionsConfig {
  return {
    categories: [],
    institutions: [],
    responsible: [],
    pending: false,
    favorite: false,
    expenseTypes: [],
    sources: [],
    paymentMethods: [],
    tags: [],
    limit: 10,
    ...overrides,
  };
}

describe("getFilteredTransactions (where builder — paridade de filtros Parte A)", () => {
  beforeEach(() => {
    prismaMock.transaction.findMany.mockResolvedValue([]);
    (responsiblePartyIdsForFilter as Mock).mockResolvedValue([]);
  });

  it("sempre filtra por accountId e monthId (multi-tenancy)", async () => {
    await getFilteredTransactions("acc-1", "month-1", baseConfig());

    const where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).toMatchObject({ accountId: "acc-1", monthId: "month-1" });
  });

  it("mapeia categories → categoryId.in", async () => {
    await getFilteredTransactions("acc-1", "month-1", baseConfig({ categories: ["c1", "c2"] }));

    const where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).toMatchObject({ categoryId: { in: ["c1", "c2"] } });
  });

  it("mapeia institutions → institutionId.in", async () => {
    await getFilteredTransactions("acc-1", "month-1", baseConfig({ institutions: ["i1"] }));

    const where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).toMatchObject({ institutionId: { in: ["i1"] } });
  });

  it("mapeia expenseTypes → expenseType.in", async () => {
    await getFilteredTransactions(
      "acc-1",
      "month-1",
      baseConfig({ expenseTypes: ["fixed", "variable"] }),
    );

    const where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).toMatchObject({ expenseType: { in: ["fixed", "variable"] } });
  });

  it("mapeia sources → source.in", async () => {
    await getFilteredTransactions("acc-1", "month-1", baseConfig({ sources: ["manual"] }));

    const where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).toMatchObject({ source: { in: ["manual"] } });
  });

  it("mapeia paymentMethods → paymentMethod.in", async () => {
    await getFilteredTransactions(
      "acc-1",
      "month-1",
      baseConfig({ paymentMethods: ["pix", "boleto"] }),
    );

    const where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).toMatchObject({ paymentMethod: { in: ["pix", "boleto"] } });
  });

  it("mapeia tags → tags.some.tagId.in (OR — qualquer tag selecionada)", async () => {
    await getFilteredTransactions("acc-1", "month-1", baseConfig({ tags: ["t1", "t2"] }));

    const where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).toMatchObject({ tags: { some: { tagId: { in: ["t1", "t2"] } } } });
  });

  it("pending=true → isPending:true; omite a cláusula quando false", async () => {
    await getFilteredTransactions("acc-1", "month-1", baseConfig({ pending: true }));
    let where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).toMatchObject({ isPending: true });

    await getFilteredTransactions("acc-1", "month-1", baseConfig({ pending: false }));
    where = prismaMock.transaction.findMany.mock.calls[1][0]!.where;
    expect(where).not.toHaveProperty("isPending");
  });

  it("favorite=true → isFavorite:true; omite a cláusula quando false", async () => {
    await getFilteredTransactions("acc-1", "month-1", baseConfig({ favorite: true }));
    let where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).toMatchObject({ isFavorite: true });

    await getFilteredTransactions("acc-1", "month-1", baseConfig({ favorite: false }));
    where = prismaMock.transaction.findMany.mock.calls[1][0]!.where;
    expect(where).not.toHaveProperty("isFavorite");
  });

  it("resolve responsible via responsiblePartyIdsForFilter (A1) e mapeia p/ responsiblePartyId.in", async () => {
    (responsiblePartyIdsForFilter as Mock).mockResolvedValue(["p1", "p2"]);

    await getFilteredTransactions(
      "acc-1",
      "month-1",
      baseConfig({ responsible: ["p1", "legacy-user-id"] }),
    );

    expect(responsiblePartyIdsForFilter).toHaveBeenCalledWith("acc-1", ["p1", "legacy-user-id"]);
    const where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).toMatchObject({ responsiblePartyId: { in: ["p1", "p2"] } });
  });

  it("omite responsiblePartyId quando o resolver não retorna nenhum id", async () => {
    (responsiblePartyIdsForFilter as Mock).mockResolvedValue([]);

    await getFilteredTransactions("acc-1", "month-1", baseConfig({ responsible: ["ghost"] }));

    const where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).not.toHaveProperty("responsiblePartyId");
  });

  it("sem filtros ativos, o where só tem accountId/monthId/table (piso do widget)", async () => {
    await getFilteredTransactions("acc-1", "month-1", baseConfig());

    const where = prismaMock.transaction.findMany.mock.calls[0][0]!.where;
    expect(where).toEqual({
      accountId: "acc-1",
      monthId: "month-1",
      table: { countInMonth: true },
    });
  });
});
