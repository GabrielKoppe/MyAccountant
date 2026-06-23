import { describe, expect, it, beforeEach, type Mock } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { getKpiCustomData } from "./kpi-custom";
import type { KpiCustomConfig } from "@/lib/schemas/widget-config";

// add: +100,00 (3 tx); subtract: 40,00 (2 tx). Net = 60,00; count = 5.
function mockRows() {
  prismaMock.section.findMany.mockResolvedValue([
    { id: "s-add", countType: "add" },
    { id: "s-sub", countType: "subtract" },
  ] as never);
  (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([
    { sectionId: "s-add", _sum: { amountCents: 10000n }, _count: { _all: 3 } },
    { sectionId: "s-sub", _sum: { amountCents: 4000n }, _count: { _all: 2 } },
  ]);
}

function cfg(metric: KpiCustomConfig["metric"]): KpiCustomConfig {
  return { metric };
}

describe("getKpiCustomData", () => {
  beforeEach(mockRows);

  it("total = líquido (entradas − saídas)", async () => {
    const r = await getKpiCustomData("acc-1", ["m1"], cfg("total"));
    expect(r.valueCents).toBe("6000");
    expect(r.count).toBe(5);
  });

  it("income = soma das seções add", async () => {
    expect((await getKpiCustomData("acc-1", ["m1"], cfg("income"))).valueCents).toBe("10000");
  });

  it("expense = soma das seções subtract", async () => {
    expect((await getKpiCustomData("acc-1", ["m1"], cfg("expense"))).valueCents).toBe("4000");
  });

  it("count = nº de transações", async () => {
    const r = await getKpiCustomData("acc-1", ["m1"], cfg("count"));
    expect(r.count).toBe(5);
    expect(r.valueCents).toBe("0");
  });

  it("avg = líquido / nº de transações", async () => {
    // 6000 / 5 = 1200
    expect((await getKpiCustomData("acc-1", ["m1"], cfg("avg"))).valueCents).toBe("1200");
  });

  it("filtra por accountId (multi-tenancy)", async () => {
    await getKpiCustomData("acc-1", ["m1"], cfg("total"));
    expect(prismaMock.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc-1", monthId: { in: ["m1"] } }),
      }),
    );
  });

  it("retorna zero quando não há meses", async () => {
    const r = await getKpiCustomData("acc-1", [], cfg("total"));
    expect(r).toEqual({ metric: "total", valueCents: "0", count: 0 });
  });
});
