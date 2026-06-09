import { describe, expect, it } from "vitest";
import {
  applyFinancialSign,
  buildCsvRow,
  CSV_BOM,
  formatCsvNumber,
  formatDateDDMMYYYY,
  toAccountSlug,
} from "./export-utils";

describe("toAccountSlug", () => {
  it("remove acentos", () => {
    expect(toAccountSlug("Família São Paulo")).toBe("familia-sao-paulo");
  });

  it("converte para minúsculas e troca espaços por hífens", () => {
    expect(toAccountSlug("My Account")).toBe("my-account");
  });

  it("colapsa múltiplos caracteres especiais em um único hífen", () => {
    expect(toAccountSlug("foo  bar!!baz")).toBe("foo-bar-baz");
  });

  it("remove hífens no início e no fim", () => {
    expect(toAccountSlug("  --foo--  ")).toBe("foo");
  });

  it("preserva slug já normalizado", () => {
    expect(toAccountSlug("my-account-123")).toBe("my-account-123");
  });
});

describe("applyFinancialSign", () => {
  it("retorna valor positivo para seções add", () => {
    expect(applyFinancialSign(150000n, "add")).toBe(1500);
  });

  it("retorna valor negativo para seções subtract", () => {
    expect(applyFinancialSign(150000n, "subtract")).toBe(-1500);
  });

  it("retorna valor bruto positivo para seções neutral", () => {
    expect(applyFinancialSign(50000n, "neutral")).toBe(500);
  });

  it("retorna valor bruto positivo para seções ignore", () => {
    expect(applyFinancialSign(50000n, "ignore")).toBe(500);
  });

  it("converte centavos para reais corretamente", () => {
    expect(applyFinancialSign(100n, "add")).toBeCloseTo(1);
    expect(applyFinancialSign(1n, "add")).toBeCloseTo(0.01);
  });
});

describe("formatCsvNumber", () => {
  it("formata inteiro com duas casas decimais", () => {
    expect(formatCsvNumber(1500)).toBe("1500.00");
  });

  it("formata valor negativo", () => {
    expect(formatCsvNumber(-1500)).toBe("-1500.00");
  });

  it("arredonda para duas casas decimais", () => {
    expect(formatCsvNumber(1234.567)).toBe("1234.57");
  });

  it("formata zero", () => {
    expect(formatCsvNumber(0)).toBe("0.00");
  });
});

describe("formatDateDDMMYYYY", () => {
  it("formata data no padrão DD/MM/YYYY", () => {
    const date = new Date("2024-03-15T00:00:00.000Z");
    expect(formatDateDDMMYYYY(date)).toBe("15/03/2024");
  });

  it("adiciona zeros à esquerda em dia e mês de um dígito", () => {
    const date = new Date("2024-01-07T00:00:00.000Z");
    expect(formatDateDDMMYYYY(date)).toBe("07/01/2024");
  });

  it("usa UTC (não ajusta timezone local)", () => {
    const date = new Date("2024-12-31T00:00:00.000Z");
    expect(formatDateDDMMYYYY(date)).toBe("31/12/2024");
  });
});

describe("buildCsvRow", () => {
  it("une células com vírgula", () => {
    expect(buildCsvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("encapsula entre aspas célula que contém vírgula", () => {
    expect(buildCsvRow(["foo,bar", "baz"])).toBe('"foo,bar",baz');
  });

  it("escapa aspas duplas dentro da célula", () => {
    expect(buildCsvRow(['say "hello"'])).toBe('"say ""hello"""');
  });

  it("encapsula entre aspas célula que contém quebra de linha", () => {
    expect(buildCsvRow(["linha1\nlinha2"])).toBe('"linha1\nlinha2"');
  });

  it("converte null e undefined em string vazia", () => {
    expect(buildCsvRow([null, undefined, "x"])).toBe(",,x");
  });

  it("converte numbers para string", () => {
    expect(buildCsvRow([42, -1500])).toBe("42,-1500");
  });

  it("CSV_BOM é o caractere correto", () => {
    expect(CSV_BOM).toBe("﻿");
  });
});
