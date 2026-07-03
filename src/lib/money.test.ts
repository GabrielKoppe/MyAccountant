import { describe, expect, it } from "vitest";

import {
  centsToReais,
  displaySignInverts,
  formatCentsToBrl,
  moveInvertsConvention,
  normalizeAmountOnMove,
  parseBrlMaskToCents,
  reaisToCents,
} from "./money";

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

describe("displaySignInverts", () => {
  it("deve inverter apenas para subtract", () => {
    expect(displaySignInverts("subtract")).toBe(true);
    expect(displaySignInverts("add")).toBe(false);
    expect(displaySignInverts("neutral")).toBe(false);
    expect(displaySignInverts("ignore")).toBe(false);
  });
});

describe("moveInvertsConvention", () => {
  it("deve ser true quando exatamente um lado é subtract", () => {
    expect(moveInvertsConvention("subtract", "add")).toBe(true);
    expect(moveInvertsConvention("add", "subtract")).toBe(true);
    expect(moveInvertsConvention("subtract", "neutral")).toBe(true);
    expect(moveInvertsConvention("ignore", "subtract")).toBe(true);
  });

  it("deve ser false quando ambos subtract ou nenhum subtract", () => {
    expect(moveInvertsConvention("subtract", "subtract")).toBe(false);
    expect(moveInvertsConvention("add", "neutral")).toBe(false);
    expect(moveInvertsConvention("add", "ignore")).toBe(false);
    expect(moveInvertsConvention("neutral", "ignore")).toBe(false);
    expect(moveInvertsConvention("add", "add")).toBe(false);
  });
});

describe("normalizeAmountOnMove", () => {
  it("deve negar o valor quando invert e convenções diferem", () => {
    expect(normalizeAmountOnMove(10000n, "add", "subtract", true)).toBe(-10000n);
    expect(normalizeAmountOnMove(-10000n, "subtract", "add", true)).toBe(10000n);
  });

  it("não deve alterar quando convenções coincidem, mesmo com invert", () => {
    expect(normalizeAmountOnMove(10000n, "add", "neutral", true)).toBe(10000n);
    expect(normalizeAmountOnMove(-5000n, "subtract", "subtract", true)).toBe(-5000n);
  });

  it("não deve alterar quando invert desativado, mesmo com convenções diferentes", () => {
    expect(normalizeAmountOnMove(10000n, "add", "subtract", false)).toBe(10000n);
    expect(normalizeAmountOnMove(-10000n, "subtract", "ignore", false)).toBe(-10000n);
  });

  it("deve preservar magnitude BigInt em valores grandes", () => {
    expect(normalizeAmountOnMove(9007199254740993n, "add", "subtract", true)).toBe(
      -9007199254740993n,
    );
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
