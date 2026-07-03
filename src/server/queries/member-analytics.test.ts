import { beforeEach, describe, expect, it, type Mock } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { m } from "@/lib/messages";

import {
  getMemberMonthlyBreakdown,
  getMemberYearlyBreakdown,
  getMemberYearlyTrend,
} from "./member-analytics";

const ACCOUNT_ID = "acc-test-1";

// Helper: linka userId → party personal com nome de User (para o mock de findMany).
function personalParty(id: string, userId: string, name: string, archivedAt: Date | null = null) {
  return {
    id,
    name,
    kind: "personal",
    icon: null,
    archivedAt,
    members: [{ userId, user: { name, email: `${userId}@e.com` } }],
  };
}

beforeEach(() => {
  (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([] as never);
  prismaMock.accountMember.findMany.mockResolvedValue([] as never);
  prismaMock.responsibleParty.findMany.mockResolvedValue([] as never);
  prismaMock.user.findMany.mockResolvedValue([] as never);
  prismaMock.category.findMany.mockResolvedValue([] as never);
  prismaMock.month.findMany.mockResolvedValue([] as never);
});

describe("getMemberMonthlyBreakdown", () => {
  it("agrega por party, resolve nome (ao vivo/ex-membro), share, topCategory e zerados ao fim", async () => {
    (prismaMock.transaction.groupBy as unknown as Mock)
      .mockResolvedValueOnce([
        { responsiblePartyId: "pA", _sum: { amountCents: 30000n } },
        { responsiblePartyId: "pX", _sum: { amountCents: 10000n } }, // ex-membro
        { responsiblePartyId: null, _sum: { amountCents: 5000n } }, // sem responsável
      ] as never)
      .mockResolvedValueOnce([
        { responsiblePartyId: "pA", categoryId: "c1", _sum: { amountCents: 20000n } },
        { responsiblePartyId: "pA", categoryId: "c2", _sum: { amountCents: 10000n } },
        { responsiblePartyId: "pX", categoryId: null, _sum: { amountCents: 10000n } },
        { responsiblePartyId: null, categoryId: "c1", _sum: { amountCents: 5000n } },
      ] as never);

    // pA: membro atual (nome ao vivo); pX: ex-membro (snapshot); pB: ativo sem despesa (zerado).
    prismaMock.responsibleParty.findMany.mockResolvedValue([
      personalParty("pA", "uA", "Alice"),
      personalParty("pX", "uX", "Xavier"),
      personalParty("pB", "uB", "Bob"),
    ] as never);
    prismaMock.accountMember.findMany.mockResolvedValue([
      { userId: "uA" },
      { userId: "uB" },
    ] as never);
    prismaMock.category.findMany.mockResolvedValue([{ id: "c1", name: "Alimentação" }] as never);

    const rows = await getMemberMonthlyBreakdown(ACCOUNT_ID, "month-1");

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      partyId: "pA",
      name: "Alice",
      isFormerMember: false,
      totalCents: "30000",
      sharePercent: 66.7,
      topCategoryName: "Alimentação",
    });
    expect(rows[1]).toMatchObject({
      partyId: "pX",
      name: "Xavier",
      isFormerMember: true,
      totalCents: "10000",
      sharePercent: 22.2,
      topCategoryName: m.dashboards.members.uncategorized,
    });
    expect(rows[2]).toMatchObject({
      partyId: null,
      name: m.dashboards.members.unassigned,
      totalCents: "5000",
      sharePercent: 11.1,
      topCategoryName: "Alimentação",
    });
    expect(rows[3]).toMatchObject({
      partyId: "pB",
      name: "Bob",
      totalCents: "0",
      sharePercent: 0,
      topCategoryName: null,
    });
  });

  it("party group ('Casal') aparece como UMA linha com total integral (sem fan-out)", async () => {
    (prismaMock.transaction.groupBy as unknown as Mock)
      .mockResolvedValueOnce([{ responsiblePartyId: "pG", _sum: { amountCents: 40000n } }] as never)
      .mockResolvedValueOnce([
        { responsiblePartyId: "pG", categoryId: "c1", _sum: { amountCents: 40000n } },
      ] as never);
    prismaMock.responsibleParty.findMany.mockResolvedValue([
      {
        id: "pG",
        name: "Casal",
        kind: "group",
        icon: "🏠",
        archivedAt: null,
        members: [
          { userId: "uA", user: { name: "Alice", email: "a@e.com" } },
          { userId: "uB", user: { name: "Bob", email: "b@e.com" } },
        ],
      },
    ] as never);
    prismaMock.accountMember.findMany.mockResolvedValue([
      { userId: "uA" },
      { userId: "uB" },
    ] as never);
    prismaMock.category.findMany.mockResolvedValue([{ id: "c1", name: "Aluguel" }] as never);

    const rows = await getMemberMonthlyBreakdown(ACCOUNT_ID, "month-1");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      partyId: "pG",
      name: "Casal",
      icon: "🏠",
      totalCents: "40000",
      sharePercent: 100,
      isFormerMember: false,
    });
  });

  it("filtra por accountId e base de despesa (multi-tenancy)", async () => {
    await getMemberMonthlyBreakdown(ACCOUNT_ID, "month-1");

    expect(prismaMock.transaction.groupBy as unknown as Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: ACCOUNT_ID,
          monthId: "month-1",
          amountCents: { gt: 0n },
          section: { countType: "subtract" },
          table: { countInMonth: true },
        }),
      }),
    );
    expect(prismaMock.responsibleParty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: ACCOUNT_ID }),
      }),
    );
  });

  it("retorna lista vazia quando não há nenhuma despesa nem parties", async () => {
    const rows = await getMemberMonthlyBreakdown(ACCOUNT_ID, "month-1");
    expect(rows).toEqual([]);
  });
});

describe("getMemberYearlyTrend", () => {
  it("retorna vazio quando o ano não tem meses", async () => {
    prismaMock.month.findMany.mockResolvedValue([] as never);
    const series = await getMemberYearlyTrend(ACCOUNT_ID, 2026);
    expect(series).toEqual([]);
  });

  it("agrupa por mês com despesa e limita a top-5 + Outros", async () => {
    prismaMock.month.findMany.mockResolvedValue([
      { id: "m1", year: 2026, month: 1 },
      { id: "m2", year: 2026, month: 2 },
    ] as never);

    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([
      { responsiblePartyId: "p1", monthId: "m1", _sum: { amountCents: 60000n } },
      { responsiblePartyId: "p2", monthId: "m1", _sum: { amountCents: 50000n } },
      { responsiblePartyId: "p3", monthId: "m1", _sum: { amountCents: 40000n } },
      { responsiblePartyId: "p4", monthId: "m1", _sum: { amountCents: 30000n } },
      { responsiblePartyId: "p5", monthId: "m2", _sum: { amountCents: 20000n } },
      { responsiblePartyId: "p6", monthId: "m2", _sum: { amountCents: 10000n } },
    ] as never);

    prismaMock.responsibleParty.findMany.mockResolvedValue(
      ["1", "2", "3", "4", "5", "6"].map((n) => personalParty(`p${n}`, `u${n}`, `U${n}`)) as never,
    );
    prismaMock.accountMember.findMany.mockResolvedValue(
      ["1", "2", "3", "4", "5", "6"].map((n) => ({ userId: `u${n}` })) as never,
    );

    const series = await getMemberYearlyTrend(ACCOUNT_ID, 2026);

    expect(series).toHaveLength(6);
    expect(series.at(-1)).toMatchObject({ seriesId: "others", name: m.dashboards.members.others });

    for (const s of series) {
      expect(s.points).toHaveLength(2);
    }

    const others = series.at(-1)!;
    expect(others.points[0].totalCents).toBe("0");
    expect(others.points[1].totalCents).toBe("10000");
  });
});

describe("getMemberYearlyBreakdown", () => {
  beforeEach(() => {
    prismaMock.month.findMany.mockResolvedValue([] as never);
  });

  it("retorna array vazio quando não há meses no ano", async () => {
    prismaMock.month.findMany.mockResolvedValue([] as never);
    const result = await getMemberYearlyBreakdown("acc-1", 2026);
    expect(result).toHaveLength(0);
  });

  it("filtra por accountId — multi-tenancy", async () => {
    prismaMock.month.findMany.mockResolvedValue([{ id: "m-1" }] as never);
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([] as never);
    await getMemberYearlyBreakdown("acc-1", 2026);
    expect(prismaMock.month.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acc-1" }) }),
    );
  });

  it("serializa totalCents como string (BigInt seguro)", async () => {
    prismaMock.month.findMany.mockResolvedValue([{ id: "m-1" }] as never);
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([
      { responsiblePartyId: "p-1", _sum: { amountCents: 20000n } },
      { responsiblePartyId: "p-1", categoryId: "cat-1", _sum: { amountCents: 20000n } },
    ] as never);
    prismaMock.responsibleParty.findMany.mockResolvedValue([
      personalParty("p-1", "u-1", "Alice"),
    ] as never);
    prismaMock.accountMember.findMany.mockResolvedValue([{ userId: "u-1" }] as never);
    prismaMock.category.findMany.mockResolvedValue([{ id: "cat-1", name: "Alimentação" }] as never);
    const result = await getMemberYearlyBreakdown("acc-1", 2026);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0].totalCents).toBe("string");
  });

  it("trunca ao top-5 parties", async () => {
    prismaMock.month.findMany.mockResolvedValue([{ id: "m-1" }] as never);
    const byParty = Array.from({ length: 7 }, (_, i) => ({
      responsiblePartyId: `p-${i}`,
      _sum: { amountCents: BigInt((7 - i) * 1000) },
    }));
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue(byParty as never);
    prismaMock.responsibleParty.findMany.mockResolvedValue(
      byParty.map((r, i) => personalParty(r.responsiblePartyId, `u-${i}`, `User ${i}`)) as never,
    );
    prismaMock.accountMember.findMany.mockResolvedValue(
      byParty.map((_, i) => ({ userId: `u-${i}` })) as never,
    );
    const result = await getMemberYearlyBreakdown("acc-1", 2026);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
