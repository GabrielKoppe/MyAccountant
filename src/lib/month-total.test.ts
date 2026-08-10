import { describe, expect, it } from "vitest";

import { calculateMonthTotal } from "./month-total";

describe("calculateMonthTotal (função pura)", () => {
  it("deve somar seções com countType=add", () => {
    const sections = [
      { id: "s1", countType: "add" as const },
      { id: "s2", countType: "add" as const },
    ];
    const totals = { s1: 10000n, s2: 5000n };
    expect(calculateMonthTotal(sections, totals)).toBe(15000n);
  });

  it("deve subtrair seções com countType=subtract", () => {
    const sections = [
      { id: "s1", countType: "add" as const },
      { id: "s2", countType: "subtract" as const },
    ];
    const totals = { s1: 10000n, s2: 3000n };
    expect(calculateMonthTotal(sections, totals)).toBe(7000n);
  });

  it("deve somar (não subtrair) seções com countType=neutral", () => {
    const sections = [
      { id: "s1", countType: "add" as const },
      { id: "s2", countType: "neutral" as const },
    ];
    const totals = { s1: 10000n, s2: 5000n };
    expect(calculateMonthTotal(sections, totals)).toBe(15000n);
  });

  it("deve ignorar seções com countType=ignore", () => {
    const sections = [
      { id: "s1", countType: "add" as const },
      { id: "s2", countType: "ignore" as const },
    ];
    const totals = { s1: 10000n, s2: 99999n };
    expect(calculateMonthTotal(sections, totals)).toBe(10000n);
  });

  it("deve tratar seção sem total como 0", () => {
    const sections = [{ id: "s1", countType: "add" as const }];
    expect(calculateMonthTotal(sections, {})).toBe(0n);
  });

  it("deve retornar 0 para lista vazia de seções", () => {
    expect(calculateMonthTotal([], {})).toBe(0n);
  });

  it("deve calcular corretamente com combinação de todos os tipos", () => {
    const sections = [
      { id: "renda", countType: "add" as const },
      { id: "gastos", countType: "subtract" as const },
      { id: "investimentos", countType: "neutral" as const },
      { id: "informativo", countType: "ignore" as const },
    ];
    const totals = {
      renda: 500000n, // R$ 5.000
      gastos: 200000n, // R$ 2.000
      investimentos: 100000n, // R$ 1.000
      informativo: 999999n, // ignorado
    };
    // 5.000 - 2.000 + 1.000 = 4.000
    expect(calculateMonthTotal(sections, totals)).toBe(400000n);
  });

  it("deve lidar com totais negativos em seções subtract", () => {
    // Um gasto negativo (crédito/estorno) em seção subtract
    const sections = [{ id: "gastos", countType: "subtract" as const }];
    const totals = { gastos: -5000n }; // crédito de R$ 50
    // subtract(-50) = +50
    expect(calculateMonthTotal(sections, totals)).toBe(5000n);
  });
});
