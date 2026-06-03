import { describe, expect, it } from "vitest";

import {
  applyDayToMonth,
  formatDateBr,
  formatMonthLabel,
  getCurrentFiscalMonth,
  getMonthRange,
  getNextMonthSuggestion,
  parseLocalDate,
} from "./dates";

describe("applyDayToMonth", () => {
  it("deve retornar a data com o dia especificado", () => {
    const result = applyDayToMonth(15, 2026, 3);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // março = índice 2
    expect(result.getDate()).toBe(15);
  });

  it("deve limitar dia 31 em fevereiro não-bissexto para dia 28", () => {
    const result = applyDayToMonth(31, 2026, 2);
    expect(result.getDate()).toBe(28);
  });

  it("deve limitar dia 31 em junho (30 dias) para dia 30", () => {
    const result = applyDayToMonth(31, 2026, 6);
    expect(result.getDate()).toBe(30);
  });

  it("deve manter dia 29 em ano bissexto para fevereiro", () => {
    const result = applyDayToMonth(29, 2028, 2); // 2028 é bissexto
    expect(result.getDate()).toBe(29);
  });
});

describe("formatMonthLabel", () => {
  it("deve formatar mês de janeiro em português", () => {
    const result = formatMonthLabel(2026, 1);
    expect(result).toMatch(/jan/i);
    expect(result).toContain("2026");
  });

  it("deve capitalizar a primeira letra", () => {
    const result = formatMonthLabel(2026, 6);
    expect(result[0]).toBe(result[0].toUpperCase());
  });

  it("deve formatar corretamente dezembro", () => {
    const result = formatMonthLabel(2025, 12);
    expect(result).toMatch(/dez/i);
    expect(result).toContain("2025");
  });
});

describe("formatDateBr", () => {
  it("deve formatar Date object no padrão dd/MM/yyyy", () => {
    const result = formatDateBr(new Date(2026, 5, 1)); // 1 de junho de 2026
    expect(result).toBe("01/06/2026");
  });

  it("deve formatar string YYYY-MM-DD sem erro de timezone", () => {
    const result = formatDateBr("2026-06-01");
    expect(result).toBe("01/06/2026");
  });

  it("deve formatar corretamente dia 31", () => {
    const result = formatDateBr("2026-01-31");
    expect(result).toBe("31/01/2026");
  });
});

describe("parseLocalDate", () => {
  it("deve parsear string YYYY-MM-DD como data local", () => {
    const result = parseLocalDate("2026-06-15");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5); // junho = índice 5
    expect(result.getDate()).toBe(15);
  });

  it("deve parsear 1 de janeiro corretamente", () => {
    const result = parseLocalDate("2026-01-01");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });
});

describe("getNextMonthSuggestion", () => {
  it("deve retornar o mês seguinte dentro do mesmo ano", () => {
    expect(getNextMonthSuggestion({ year: 2026, month: 5 })).toEqual({ year: 2026, month: 6 });
  });

  it("deve virar o ano ao passar de dezembro", () => {
    expect(getNextMonthSuggestion({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 });
  });

  it("deve funcionar para mês 1", () => {
    expect(getNextMonthSuggestion({ year: 2026, month: 1 })).toEqual({ year: 2026, month: 2 });
  });
});

describe("getCurrentFiscalMonth", () => {
  it("deve retornar o mês corrente quando dia >= monthStartDay", () => {
    const today = new Date(2026, 5, 15); // 15 de junho
    const result = getCurrentFiscalMonth(today, 5); // começa dia 5
    expect(result).toEqual({ year: 2026, month: 6 });
  });

  it("deve retornar o mês anterior quando dia < monthStartDay", () => {
    const today = new Date(2026, 5, 3); // 3 de junho
    const result = getCurrentFiscalMonth(today, 5); // começa dia 5
    expect(result).toEqual({ year: 2026, month: 5 });
  });

  it("deve virar para dezembro do ano anterior quando é início de janeiro antes do startDay", () => {
    const today = new Date(2026, 0, 3); // 3 de janeiro
    const result = getCurrentFiscalMonth(today, 5); // começa dia 5
    expect(result).toEqual({ year: 2025, month: 12 });
  });

  it("deve retornar mês corrente quando dia = monthStartDay exato", () => {
    const today = new Date(2026, 5, 5); // 5 de junho
    const result = getCurrentFiscalMonth(today, 5);
    expect(result).toEqual({ year: 2026, month: 6 });
  });
});

describe("getMonthRange", () => {
  it("deve retornar range correto para mês com startDay=1", () => {
    const range = getMonthRange(2026, 1, 1); // Janeiro, começa dia 1
    expect(range.start.getDate()).toBe(1);
    expect(range.start.getMonth()).toBe(0); // janeiro
    expect(range.end.getDate()).toBe(31); // último dia de janeiro
    expect(range.end.getMonth()).toBe(0);
  });

  it("deve respeitar monthStartDay diferente de 1", () => {
    const range = getMonthRange(2026, 6, 5); // Junho, começa dia 5
    expect(range.start.getDate()).toBe(5);
    expect(range.start.getMonth()).toBe(5); // junho
    // O fim é o dia anterior ao próximo início (4 de julho)
    expect(range.end.getDate()).toBe(4);
    expect(range.end.getMonth()).toBe(6); // julho
  });

  it("deve limitar startDay ao último dia do mês em fevereiro", () => {
    const range = getMonthRange(2026, 2, 31); // Fevereiro, startDay=31
    expect(range.start.getDate()).toBe(28); // fevereiro 2026 tem 28 dias
  });
});
