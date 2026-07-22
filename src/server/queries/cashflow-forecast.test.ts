import { describe, expect, it, type Mock } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

import { getCashflowForecast } from "./cashflow-forecast";

function settingsRow(overrides: Record<string, unknown> = {}) {
  return {
    monthStartDay: 1,
    forecastHorizonMonths: 3,
    forecastScenario: "realistic",
    forecastOptimisticPct: 10,
    forecastConservativePct: 20,
    forecastVariableWindow: 6,
    forecastStartBalanceCents: null,
    ...overrides,
  };
}

// Mocks mínimos para a query rodar de ponta a ponta sem lançar erro.
function setupBaseMocks() {
  prismaMock.section.findMany.mockResolvedValue([]);
  prismaMock.month.findMany.mockResolvedValue([]);
  prismaMock.tableTemplate.findMany.mockResolvedValue([]);
  prismaMock.pendingInstallment.findMany.mockResolvedValue([]);
  (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([]);
}

describe("getCashflowForecast — multi-tenancy", () => {
  it("filtra accountId em toda leitura", async () => {
    setupBaseMocks();
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);

    await getCashflowForecast("acc-test-1");

    expect(prismaMock.section.findMany.mock.calls.length).toBeGreaterThan(0);
    for (const call of prismaMock.section.findMany.mock.calls) {
      expect(call[0]?.where).toMatchObject({ accountId: "acc-test-1" });
    }

    expect(prismaMock.month.findMany.mock.calls.length).toBeGreaterThan(0);
    for (const call of prismaMock.month.findMany.mock.calls) {
      expect(call[0]?.where).toMatchObject({ accountId: "acc-test-1" });
    }

    expect(prismaMock.tableTemplate.findMany.mock.calls.length).toBeGreaterThan(0);
    for (const call of prismaMock.tableTemplate.findMany.mock.calls) {
      expect(call[0]?.where).toMatchObject({ accountId: "acc-test-1" });
    }

    expect(prismaMock.pendingInstallment.findMany.mock.calls.length).toBeGreaterThan(0);
    for (const call of prismaMock.pendingInstallment.findMany.mock.calls) {
      expect(call[0]?.where).toMatchObject({ accountId: "acc-test-1" });
    }
  });

  it("estimado exclui auto_template, parcelas e one_time", async () => {
    setupBaseMocks();
    prismaMock.accountSettings.findUnique.mockResolvedValue(
      settingsRow({ forecastVariableWindow: 6 }) as any,
    );
    // 6 meses fechados, estritamente antes do mês fiscal corrente (datas seguras no passado)
    // — necessário para effectiveWindow = min(forecastVariableWindow, closedMonthCount) > 0
    // e assim exercitar o branch do groupBy da média estimada.
    const closedMonths = Array.from({ length: 6 }, (_, i) => ({
      id: `m-${i}`,
      year: 2020,
      month: i + 1,
    }));
    prismaMock.month.findMany.mockResolvedValue(closedMonths as any);

    await getCashflowForecast("acc-test-1");

    // toHaveBeenCalledWith casa contra QUALQUER chamada do mock — isola a chamada de
    // groupBy do estimado (by: ["sectionId"]) da chamada de saldo de partida
    // (by: ["monthId","sectionId"], sem estes filtros) sem depender de índice/ordem.
    expect(prismaMock.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: "acc-test-1",
          source: { not: "auto_template" },
          installmentGroupId: null,
          // OR (em vez de `expenseType: { not: "one_time" }` direto) — NULL (imports CSV) precisa
          // ser incluído explicitamente, pois `<> 'one_time'` no Postgres é NULL (not-true) para
          // linhas com expenseType NULL, o que as excluiria silenciosamente do filtro.
          OR: [{ expenseType: null }, { expenseType: { not: "one_time" } }],
        }),
      }),
    );

    // Esta mesma seed de meses fechados também exercita o groupBy do saldo de
    // partida (by: ["monthId","sectionId"]) — garante que ele também carrega
    // accountId (multi-tenancy), isolado do groupBy do estimado acima.
    expect(prismaMock.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["monthId", "sectionId"],
        where: expect.objectContaining({ accountId: "acc-test-1" }),
      }),
    );
  });
});
