import { describe, expect, it } from "vitest";

import {
  dayRuleToDay,
  formatDayRule,
  isDayRuleString,
  parseDayRule,
  resolveDayRule,
  serializeDayRule,
  type DayRule,
} from "./day-rule";

/** "2026-02-28" — compara a data local sem esbarrar em timezone. */
function iso(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

describe("parseDayRule", () => {
  it("reconhece as duas regras relativas", () => {
    expect(parseDayRule("last", 1)).toEqual({ kind: "last" });
    expect(parseDayRule("firstBusiness", 1)).toEqual({ kind: "firstBusiness" });
  });

  it("reconhece dia fixo em string", () => {
    expect(parseDayRule("5", 1)).toEqual({ kind: "fixed", day: 5 });
    expect(parseDayRule("31", 1)).toEqual({ kind: "fixed", day: 31 });
  });

  it("null cai no fallback (a coluna `day` do item, anterior à Spec 69)", () => {
    expect(parseDayRule(null, 18)).toEqual({ kind: "fixed", day: 18 });
    expect(parseDayRule(undefined, 7)).toEqual({ kind: "fixed", day: 7 });
  });

  it("lixo cai no fallback em vez de explodir", () => {
    expect(parseDayRule("terça", 3)).toEqual({ kind: "fixed", day: 3 });
    expect(parseDayRule("0", 3)).toEqual({ kind: "fixed", day: 3 });
    expect(parseDayRule("99", 3)).toEqual({ kind: "fixed", day: 3 });
  });

  it("fallback fora de 1–31 é limitado", () => {
    expect(parseDayRule(null, 0)).toEqual({ kind: "fixed", day: 1 });
    expect(parseDayRule(null, 99)).toEqual({ kind: "fixed", day: 31 });
  });
});

describe("serializeDayRule / isDayRuleString", () => {
  it("ida e volta preserva a regra", () => {
    const rules: DayRule[] = [
      { kind: "fixed", day: 5 },
      { kind: "last" },
      { kind: "firstBusiness" },
    ];
    for (const rule of rules) {
      expect(parseDayRule(serializeDayRule(rule), 1)).toEqual(rule);
    }
  });

  it("tudo que serializa é aceito pelo padrão do schema", () => {
    expect(isDayRuleString(serializeDayRule({ kind: "fixed", day: 31 }))).toBe(true);
    expect(isDayRuleString(serializeDayRule({ kind: "last" }))).toBe(true);
    expect(isDayRuleString(serializeDayRule({ kind: "firstBusiness" }))).toBe(true);
    expect(isDayRuleString("0")).toBe(false);
    expect(isDayRuleString("32")).toBe(false);
    expect(isDayRuleString("último")).toBe(false);
  });
});

describe("dayRuleToDay — espelho da coluna legada `day`", () => {
  it("last vira 31 (ordena por último) e firstBusiness vira 1", () => {
    expect(dayRuleToDay({ kind: "last" })).toBe(31);
    expect(dayRuleToDay({ kind: "firstBusiness" })).toBe(1);
    expect(dayRuleToDay({ kind: "fixed", day: 12 })).toBe(12);
  });
});

describe("resolveDayRule — dia fixo", () => {
  it("mês de 31 dias mantém o dia 31", () => {
    expect(iso(resolveDayRule({ kind: "fixed", day: 31 }, 2026, 1))).toBe("2026-01-31");
  });

  it("mês de 30 dias corta o dia 31 para o último", () => {
    expect(iso(resolveDayRule({ kind: "fixed", day: 31 }, 2026, 4))).toBe("2026-04-30");
  });

  it("fevereiro comum: dia 30 cai em 28", () => {
    expect(iso(resolveDayRule({ kind: "fixed", day: 30 }, 2026, 2))).toBe("2026-02-28");
  });

  it("fevereiro bissexto: dia 30 cai em 29", () => {
    expect(iso(resolveDayRule({ kind: "fixed", day: 30 }, 2024, 2))).toBe("2024-02-29");
  });

  it("dia dentro do mês não é alterado", () => {
    expect(iso(resolveDayRule({ kind: "fixed", day: 5 }, 2026, 2))).toBe("2026-02-05");
  });
});

describe("resolveDayRule — último dia", () => {
  it("fevereiro comum → 28", () => {
    expect(iso(resolveDayRule({ kind: "last" }, 2026, 2))).toBe("2026-02-28");
  });

  it("fevereiro bissexto → 29", () => {
    expect(iso(resolveDayRule({ kind: "last" }, 2024, 2))).toBe("2024-02-29");
  });

  it("ano secular não bissexto (2100) → 28", () => {
    expect(iso(resolveDayRule({ kind: "last" }, 2100, 2))).toBe("2100-02-28");
  });

  it("mês de 30 e de 31 dias", () => {
    expect(iso(resolveDayRule({ kind: "last" }, 2026, 4))).toBe("2026-04-30");
    expect(iso(resolveDayRule({ kind: "last" }, 2026, 12))).toBe("2026-12-31");
  });
});

describe("resolveDayRule — primeiro dia útil", () => {
  it("dia 1 em dia de semana é o próprio dia 1", () => {
    // 2026-06-01 é uma segunda-feira.
    const date = resolveDayRule({ kind: "firstBusiness" }, 2026, 6);
    expect(iso(date)).toBe("2026-06-01");
    expect(date.getDay()).toBe(1);
  });

  it("dia 1 no sábado pula para a segunda (dia 3)", () => {
    // 2026-08-01 é um sábado.
    expect(new Date(2026, 7, 1).getDay()).toBe(6);
    expect(iso(resolveDayRule({ kind: "firstBusiness" }, 2026, 8))).toBe("2026-08-03");
  });

  it("dia 1 no domingo pula para a segunda (dia 2)", () => {
    // 2026-02-01 é um domingo.
    expect(new Date(2026, 1, 1).getDay()).toBe(0);
    expect(iso(resolveDayRule({ kind: "firstBusiness" }, 2026, 2))).toBe("2026-02-02");
  });

  it("nunca cai em sábado ou domingo, varrendo um ano inteiro", () => {
    for (let month = 1; month <= 12; month++) {
      const day = resolveDayRule({ kind: "firstBusiness" }, 2026, month).getDay();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
    }
  });

  it("feriado NÃO é considerado — decisão consciente (sem calendário)", () => {
    // 2026-01-01 é uma quinta-feira e feriado nacional; a regra devolve o dia 1
    // mesmo assim, porque só conhece fim de semana.
    expect(iso(resolveDayRule({ kind: "firstBusiness" }, 2026, 1))).toBe("2026-01-01");
  });
});

describe("formatDayRule", () => {
  it("usa os rótulos centralizados de m.settings.presentation", () => {
    expect(formatDayRule({ kind: "fixed", day: 5 })).toBe("dia 5");
    expect(formatDayRule({ kind: "last" })).toBe("último dia");
    expect(formatDayRule({ kind: "firstBusiness" })).toBe("primeiro dia útil");
  });
});
