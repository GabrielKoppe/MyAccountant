import { describe, expect, it } from "vitest";

import { centsToReais, formatCentsToBrl, parseBrlMaskToCents, reaisToCents } from "./money";

describe("centsToReais", () => {
  it("deve converter centavos para reais", () => {
    expect(centsToReais(12345n)).toBe(123.45);
  });

  it("deve retornar 0 para 0 centavos", () => {
    expect(centsToReais(0n)).toBe(0);
  });

  it("deve converter valor negativo corretamente", () => {
    expect(centsToReais(-10000n)).toBe(-100);
  });

  it("deve converter valor inteiro de reais", () => {
    expect(centsToReais(100n)).toBe(1);
  });
});

describe("reaisToCents", () => {
  it("deve converter reais para centavos", () => {
    expect(reaisToCents(123.45)).toBe(12345n);
  });

  it("deve arredondar frações de centavo", () => {
    expect(reaisToCents(1.234)).toBe(123n);
    expect(reaisToCents(1.235)).toBe(124n);
  });

  it("deve converter valor negativo", () => {
    expect(reaisToCents(-100)).toBe(-10000n);
  });

  it("deve retornar 0 para 0", () => {
    expect(reaisToCents(0)).toBe(0n);
  });
});

describe("formatCentsToBrl", () => {
  it("deve formatar valor positivo contendo os dígitos corretos", () => {
    const result = formatCentsToBrl(12345n);
    expect(result).toContain("123");
    expect(result).toContain("45");
  });

  it("deve usar valor absoluto para negativo (sem sign)", () => {
    const result = formatCentsToBrl(-10000n);
    expect(result).not.toContain("-");
    expect(result).toContain("100");
  });

  it("deve adicionar sinal negativo quando options.sign=true e valor negativo", () => {
    const result = formatCentsToBrl(-10000n, { sign: true });
    expect(result).toContain("-");
    expect(result).toContain("100");
  });

  it("não deve adicionar sinal negativo quando options.sign=true e valor positivo", () => {
    const result = formatCentsToBrl(10000n, { sign: true });
    expect(result).not.toContain("-");
  });

  it("deve formatar zero como R$ 0,00", () => {
    const result = formatCentsToBrl(0n);
    expect(result).toContain("0");
  });
});

describe("parseBrlMaskToCents", () => {
  it("deve parsear formato BRL com R$ e separadores", () => {
    expect(parseBrlMaskToCents("R$ 1.234,56")).toBe(123456n);
  });

  it("deve parsear valor simples com vírgula decimal", () => {
    expect(parseBrlMaskToCents("100,00")).toBe(10000n);
  });

  it("deve parsear valor sem centavos", () => {
    expect(parseBrlMaskToCents("100")).toBe(10000n);
  });

  it("deve manter sinal negativo", () => {
    expect(parseBrlMaskToCents("-R$ 100,00")).toBe(-10000n);
  });

  it("deve retornar 0 para string inválida", () => {
    expect(parseBrlMaskToCents("abc")).toBe(0n);
  });

  it("deve retornar 0 para string vazia", () => {
    expect(parseBrlMaskToCents("")).toBe(0n);
  });

  it("deve parsear valor com múltiplos separadores de milhar", () => {
    expect(parseBrlMaskToCents("R$ 1.000.000,00")).toBe(100000000n);
  });
});
