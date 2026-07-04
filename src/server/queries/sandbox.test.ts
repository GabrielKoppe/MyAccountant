import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { m } from "@/lib/messages";
import type { SandboxConfig } from "@/lib/schemas/sandbox";

import { prismaMock } from "../../../tests/mocks/prisma";

// Mock isolado: testamos a construção do `where`/dimensões de sandbox.ts, não a lógica
// interna de responsiblePartyIdsForFilter/partyDisplayMap (cobertas em
// responsible-party-filter.test.ts).
vi.mock("./responsible-party-filter", () => ({
  responsiblePartyIdsForFilter: vi.fn(),
  partyDisplayMap: vi.fn(),
}));

import { responsiblePartyIdsForFilter, partyDisplayMap } from "./responsible-party-filter";
import { getSandboxData } from "./sandbox";

function baseConfig(overrides: Partial<SandboxConfig> = {}): SandboxConfig {
  return {
    periodType: "months",
    monthIds: ["m1"],
    groupBy: "category",
    seriesBy: "none",
    metric: "total",
    chartType: "bar_grouped",
    ...overrides,
  } as SandboxConfig;
}

function groupByMock() {
  return prismaMock.transaction.groupBy as unknown as Mock;
}

describe("getSandboxData (where builder — paridade de filtros Parte A/A2)", () => {
  beforeEach(() => {
    (responsiblePartyIdsForFilter as Mock).mockResolvedValue([]);
    (partyDisplayMap as Mock).mockResolvedValue(new Map());
    prismaMock.month.findMany.mockResolvedValue([{ id: "m1", year: 2026, month: 7 }] as never);
    prismaMock.section.findMany.mockResolvedValue([
      { id: "s1", name: "Seção 1", countType: "subtract", order: 0 },
    ] as never);
    prismaMock.category.findMany.mockResolvedValue([] as never);
    groupByMock().mockResolvedValue([]);
  });

  it("sempre filtra por accountId e monthId (multi-tenancy)", async () => {
    await getSandboxData("acc-1", baseConfig());

    const where = groupByMock().mock.calls[0]![0].where;
    expect(where).toMatchObject({ accountId: "acc-1", monthId: { in: ["m1"] } });
  });

  it("mapeia filterCategoryIds → categoryId.in", async () => {
    await getSandboxData("acc-1", baseConfig({ filterCategoryIds: ["c1"] }));

    const where = groupByMock().mock.calls[0]![0].where;
    expect(where).toMatchObject({ categoryId: { in: ["c1"] } });
  });

  it("mapeia filterInstitutionIds → institutionId.in", async () => {
    await getSandboxData("acc-1", baseConfig({ filterInstitutionIds: ["i1"] }));

    const where = groupByMock().mock.calls[0]![0].where;
    expect(where).toMatchObject({ institutionId: { in: ["i1"] } });
  });

  it("mapeia filterTagIds → tags.some.tagId.in (OR — qualquer tag selecionada)", async () => {
    await getSandboxData("acc-1", baseConfig({ filterTagIds: ["t1", "t2"] }));

    const where = groupByMock().mock.calls[0]![0].where;
    expect(where).toMatchObject({ tags: { some: { tagId: { in: ["t1", "t2"] } } } });
  });

  it("mapeia filterExpenseTypes → expenseType.in", async () => {
    await getSandboxData("acc-1", baseConfig({ filterExpenseTypes: ["fixed", "variable"] }));

    const where = groupByMock().mock.calls[0]![0].where;
    expect(where).toMatchObject({ expenseType: { in: ["fixed", "variable"] } });
  });

  it("mapeia filterSources → source.in", async () => {
    await getSandboxData("acc-1", baseConfig({ filterSources: ["manual"] }));

    const where = groupByMock().mock.calls[0]![0].where;
    expect(where).toMatchObject({ source: { in: ["manual"] } });
  });

  it("mapeia filterPaymentMethods → paymentMethod.in", async () => {
    await getSandboxData("acc-1", baseConfig({ filterPaymentMethods: ["pix", "boleto"] }));

    const where = groupByMock().mock.calls[0]![0].where;
    expect(where).toMatchObject({ paymentMethod: { in: ["pix", "boleto"] } });
  });

  it("filterPending=true → isPending:true; omite quando ausente", async () => {
    await getSandboxData("acc-1", baseConfig({ filterPending: true }));
    let where = groupByMock().mock.calls[0]![0].where;
    expect(where).toMatchObject({ isPending: true });

    await getSandboxData("acc-1", baseConfig({ filterPending: false }));
    where = groupByMock().mock.calls[1]![0].where;
    expect(where).not.toHaveProperty("isPending");
  });

  it("filterFavorite=true → isFavorite:true; omite quando ausente", async () => {
    await getSandboxData("acc-1", baseConfig({ filterFavorite: true }));
    let where = groupByMock().mock.calls[0]![0].where;
    expect(where).toMatchObject({ isFavorite: true });

    await getSandboxData("acc-1", baseConfig({ filterFavorite: false }));
    where = groupByMock().mock.calls[1]![0].where;
    expect(where).not.toHaveProperty("isFavorite");
  });

  it("resolve filterMemberIds (responsible) via responsiblePartyIdsForFilter (A1)", async () => {
    (responsiblePartyIdsForFilter as Mock).mockResolvedValue(["p1", "p2"]);

    await getSandboxData("acc-1", baseConfig({ filterMemberIds: ["p1", "legacy-user-id"] }));

    expect(responsiblePartyIdsForFilter).toHaveBeenCalledWith("acc-1", ["p1", "legacy-user-id"]);
    const where = groupByMock().mock.calls[0]![0].where;
    expect(where).toMatchObject({ responsiblePartyId: { in: ["p1", "p2"] } });
  });

  it("omite responsiblePartyId quando o resolver não retorna nenhum id", async () => {
    (responsiblePartyIdsForFilter as Mock).mockResolvedValue([]);

    await getSandboxData("acc-1", baseConfig({ filterMemberIds: ["ghost"] }));

    const where = groupByMock().mock.calls[0]![0].where;
    expect(where).not.toHaveProperty("responsiblePartyId");
  });

  // ─── Novas dimensões escalares (Parte A / A2) ────────────────────────────

  it("groupBy=payment_method agrupa por paymentMethod e rotula via m.transactions.paymentMethods", async () => {
    groupByMock().mockResolvedValue([
      { paymentMethod: "pix", sectionId: "s1", _sum: { amountCents: 5000n }, _count: { _all: 2 } },
      { paymentMethod: null, sectionId: "s1", _sum: { amountCents: 3000n }, _count: { _all: 1 } },
    ]);

    const result = await getSandboxData("acc-1", baseConfig({ groupBy: "payment_method" }));

    const call = groupByMock().mock.calls[0]![0];
    expect(call.by).toContain("paymentMethod");
    expect(result.rows.map((r) => r.xLabel)).toEqual([
      m.transactions.paymentMethods.pix,
      m.transactions.paymentMethodNone,
    ]);
  });

  it("groupBy=expense_type agrupa por expenseType e rotula via m.transactions.expenseTypes", async () => {
    groupByMock().mockResolvedValue([
      {
        expenseType: "fixed",
        sectionId: "s1",
        _sum: { amountCents: 1000n },
        _count: { _all: 1 },
      },
    ]);

    const result = await getSandboxData("acc-1", baseConfig({ groupBy: "expense_type" }));

    const call = groupByMock().mock.calls[0]![0];
    expect(call.by).toContain("expenseType");
    expect(result.rows[0]!.xLabel).toBe(m.transactions.expenseTypes.fixed);
  });

  it("groupBy=source agrupa por source e rotula via m.transactions.sources", async () => {
    groupByMock().mockResolvedValue([
      { source: "manual", sectionId: "s1", _sum: { amountCents: 1000n }, _count: { _all: 1 } },
    ]);

    const result = await getSandboxData("acc-1", baseConfig({ groupBy: "source" }));

    const call = groupByMock().mock.calls[0]![0];
    expect(call.by).toContain("source");
    expect(result.rows[0]!.xLabel).toBe(m.transactions.sources.manual);
  });

  it("sem filtros ativos, o where só tem os campos-piso do widget", async () => {
    await getSandboxData("acc-1", baseConfig());

    const where = groupByMock().mock.calls[0]![0].where;
    expect(where).toEqual({
      accountId: "acc-1",
      monthId: { in: ["m1"] },
      table: { countInMonth: true },
      sectionId: { in: ["s1"] },
    });
  });
});
