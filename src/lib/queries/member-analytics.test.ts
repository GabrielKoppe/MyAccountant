import { beforeEach, describe, expect, it, type Mock } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { m } from "@/lib/messages";

import { getMemberMonthlyBreakdown, getMemberYearlyTrend } from "./member-analytics";

const ACCOUNT_ID = "acc-test-1";

beforeEach(() => {
  // Defaults vazios — cada teste sobrescreve o que precisa.
  (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([] as never);
  prismaMock.accountMember.findMany.mockResolvedValue([] as never);
  prismaMock.user.findMany.mockResolvedValue([] as never);
  prismaMock.category.findMany.mockResolvedValue([] as never);
  prismaMock.month.findMany.mockResolvedValue([] as never);
});

describe("getMemberMonthlyBreakdown", () => {
  it("agrega por responsável, calcula share, topCategory e ranking com zerados ao fim", async () => {
    // 1ª groupBy (por responsável)
    (prismaMock.transaction.groupBy as unknown as Mock)
      .mockResolvedValueOnce([
        { responsibleUserId: "uA", _sum: { amountCents: 30000n } },
        { responsibleUserId: "uX", _sum: { amountCents: 10000n } }, // ex-membro
        { responsibleUserId: null, _sum: { amountCents: 5000n } }, // sem responsável
      ] as never)
      // 2ª groupBy (por responsável + categoria)
      .mockResolvedValueOnce([
        { responsibleUserId: "uA", categoryId: "c1", _sum: { amountCents: 20000n } },
        { responsibleUserId: "uA", categoryId: "c2", _sum: { amountCents: 10000n } },
        { responsibleUserId: "uX", categoryId: null, _sum: { amountCents: 10000n } },
        { responsibleUserId: null, categoryId: "c1", _sum: { amountCents: 5000n } },
      ] as never);

    prismaMock.accountMember.findMany.mockResolvedValue([
      { userId: "uA", user: { name: "Alice", email: "a@e.com" } },
      { userId: "uB", user: { name: "Bob", email: "b@e.com" } }, // sem despesa → zerado
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "uX", name: "Xavier", email: "x@e.com" },
    ] as never);
    prismaMock.category.findMany.mockResolvedValue([{ id: "c1", name: "Alimentação" }] as never);

    const rows = await getMemberMonthlyBreakdown(ACCOUNT_ID, "month-1");

    expect(rows).toHaveLength(4);

    // Ordenado por total desc
    expect(rows[0]).toMatchObject({
      userId: "uA",
      name: "Alice",
      isFormerMember: false,
      totalCents: "30000",
      sharePercent: 66.7,
      topCategoryName: "Alimentação",
    });
    // Ex-membro: topo sem categoria → "Sem categoria"
    expect(rows[1]).toMatchObject({
      userId: "uX",
      name: "Xavier",
      isFormerMember: true,
      totalCents: "10000",
      sharePercent: 22.2,
      topCategoryName: m.dashboards.members.uncategorized,
    });
    // Sem responsável
    expect(rows[2]).toMatchObject({
      userId: null,
      name: m.dashboards.members.unassigned,
      totalCents: "5000",
      sharePercent: 11.1,
      topCategoryName: "Alimentação",
    });
    // Membro atual sem despesa → zerado ao fim
    expect(rows[3]).toMatchObject({
      userId: "uB",
      name: "Bob",
      totalCents: "0",
      sharePercent: 0,
      topCategoryName: null,
    });
  });

  it("filtra por accountId e base de despesa (multi-tenancy)", async () => {
    await getMemberMonthlyBreakdown(ACCOUNT_ID, "month-1");

    expect((prismaMock.transaction.groupBy as unknown as Mock)).toHaveBeenCalledWith(
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
    expect(prismaMock.accountMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: ACCOUNT_ID } }),
    );
  });

  it("não consulta User quando todos os responsáveis são membros atuais", async () => {
    (prismaMock.transaction.groupBy as unknown as Mock)
      .mockResolvedValueOnce([{ responsibleUserId: "uA", _sum: { amountCents: 1000n } }] as never)
      .mockResolvedValueOnce([
        { responsibleUserId: "uA", categoryId: "c1", _sum: { amountCents: 1000n } },
      ] as never);
    prismaMock.accountMember.findMany.mockResolvedValue([
      { userId: "uA", user: { name: "Alice", email: "a@e.com" } },
    ] as never);
    prismaMock.category.findMany.mockResolvedValue([{ id: "c1", name: "Alimentação" }] as never);

    await getMemberMonthlyBreakdown(ACCOUNT_ID, "month-1");

    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("retorna lista vazia quando não há nenhuma despesa nem membros", async () => {
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

    // 6 responsáveis com gastos diferentes → 5 viram série, 1 cai em "Outros".
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([
      { responsibleUserId: "u1", monthId: "m1", _sum: { amountCents: 60000n } },
      { responsibleUserId: "u2", monthId: "m1", _sum: { amountCents: 50000n } },
      { responsibleUserId: "u3", monthId: "m1", _sum: { amountCents: 40000n } },
      { responsibleUserId: "u4", monthId: "m1", _sum: { amountCents: 30000n } },
      { responsibleUserId: "u5", monthId: "m2", _sum: { amountCents: 20000n } },
      { responsibleUserId: "u6", monthId: "m2", _sum: { amountCents: 10000n } },
    ] as never);

    prismaMock.accountMember.findMany.mockResolvedValue([
      { userId: "u1", user: { name: "U1", email: "u1@e.com" } },
      { userId: "u2", user: { name: "U2", email: "u2@e.com" } },
      { userId: "u3", user: { name: "U3", email: "u3@e.com" } },
      { userId: "u4", user: { name: "U4", email: "u4@e.com" } },
      { userId: "u5", user: { name: "U5", email: "u5@e.com" } },
      { userId: "u6", user: { name: "U6", email: "u6@e.com" } },
    ] as never);

    const series = await getMemberYearlyTrend(ACCOUNT_ID, 2026);

    // 5 séries + linha "Outros"
    expect(series).toHaveLength(6);
    expect(series.at(-1)).toMatchObject({ seriesId: "others", name: m.dashboards.members.others });

    // Cada série tem um ponto por mês com despesa (2 meses)
    for (const s of series) {
      expect(s.points).toHaveLength(2);
      expect(s.points.map((p) => p.monthLabel)).toEqual([
        series[0].points[0].monthLabel,
        series[0].points[1].monthLabel,
      ]);
    }

    // "Outros" = u6 (10000) → m1: 0, m2: 10000
    const others = series.at(-1)!;
    expect(others.points[0].totalCents).toBe("0");
    expect(others.points[1].totalCents).toBe("10000");
  });
});
