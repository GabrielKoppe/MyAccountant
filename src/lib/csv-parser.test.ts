import { describe, expect, it } from "vitest";

import { parseDateString, parseAmountToCents, applyMappingToRows } from "./csv-parser";
import type { ImportMapping } from "./schemas/csv-import";
import { DEFAULT_MAPPING } from "./schemas/csv-import";

function mkMapping(overrides: Partial<ImportMapping> = {}): ImportMapping {
  return {
    ...DEFAULT_MAPPING,
    ...overrides,
    columns: { date: "Data", amount: "Valor", ...overrides.columns },
  };
}

describe("parseDateString", () => {
  describe("formato BR (DD/MM/YYYY)", () => {
    it("analisa data brasileira válida", () => {
      expect(parseDateString("03/01/2026", "DD/MM/YYYY")).toBe("2026-01-03");
    });

    it("analisa data com mês dois dígitos e último dia do ano", () => {
      expect(parseDateString("31/12/2025", "DD/MM/YYYY")).toBe("2025-12-31");
    });

    it("normaliza tokens maiúsculos para date-fns v3", () => {
      expect(parseDateString("15/06/2026", "DD/MM/YYYY")).toBe("2026-06-15");
    });
  });

  describe("formato ISO (YYYY-MM-DD)", () => {
    it("analisa data no formato ISO", () => {
      expect(parseDateString("2026-01-03", "YYYY-MM-DD")).toBe("2026-01-03");
    });
  });

  describe("formato US (MM/DD/YYYY)", () => {
    it("analisa data no formato americano", () => {
      expect(parseDateString("01/03/2026", "MM/DD/YYYY")).toBe("2026-01-03");
    });
  });

  describe("formato curto (DD/MM/YY)", () => {
    it("analisa data com ano de dois dígitos", () => {
      const result = parseDateString("03/01/26", "DD/MM/YY");
      expect(result).toMatch(/^\d{4}-01-03$/);
    });
  });

  describe("casos inválidos", () => {
    it("retorna null para string vazia", () => {
      expect(parseDateString("", "DD/MM/YYYY")).toBeNull();
    });

    it("retorna null para string só com espaços", () => {
      expect(parseDateString("   ", "DD/MM/YYYY")).toBeNull();
    });

    it("retorna null para dia inválido (32)", () => {
      expect(parseDateString("32/01/2026", "DD/MM/YYYY")).toBeNull();
    });

    it("retorna null para texto arbitrário", () => {
      expect(parseDateString("não-é-data", "DD/MM/YYYY")).toBeNull();
    });

    it("retorna null quando formato não corresponde ao valor", () => {
      expect(parseDateString("2026-01-03", "DD/MM/YYYY")).toBeNull();
    });
  });
});

describe("parseAmountToCents", () => {
  describe("formato BRL (ponto = milhar, vírgula = decimal)", () => {
    it("analisa valor simples", () => {
      expect(parseAmountToCents("10,00", "brl", "raw")).toBe(1000n);
    });

    it("analisa valor com separador de milhar", () => {
      expect(parseAmountToCents("1.234,56", "brl", "raw")).toBe(123456n);
    });

    it("analisa valor inteiro sem casas decimais", () => {
      expect(parseAmountToCents("1.000", "brl", "raw")).toBe(100000n);
    });

    it("remove símbolo R$", () => {
      expect(parseAmountToCents("R$ 50,00", "brl", "raw")).toBe(5000n);
    });
  });

  describe("formato US (vírgula = milhar, ponto = decimal)", () => {
    it("analisa valor simples US", () => {
      expect(parseAmountToCents("10.00", "us", "raw")).toBe(1000n);
    });

    it("analisa valor com separador de milhar US", () => {
      expect(parseAmountToCents("1,234.56", "us", "raw")).toBe(123456n);
    });

    it("remove símbolo $", () => {
      expect(parseAmountToCents("$50.00", "us", "raw")).toBe(5000n);
    });
  });

  describe("valores negativos", () => {
    it("analisa sinal no início", () => {
      expect(parseAmountToCents("-100,00", "brl", "raw")).toBe(-10000n);
    });

    it("analisa sinal no fim (padrão de alguns extratos)", () => {
      expect(parseAmountToCents("100,00-", "brl", "raw")).toBe(-10000n);
    });
  });

  describe("signMode", () => {
    it("raw — preserva o sinal original", () => {
      expect(parseAmountToCents("50,00", "brl", "raw")).toBe(5000n);
      expect(parseAmountToCents("-50,00", "brl", "raw")).toBe(-5000n);
    });

    it("invert — inverte o sinal", () => {
      expect(parseAmountToCents("50,00", "brl", "invert")).toBe(-5000n);
      expect(parseAmountToCents("-50,00", "brl", "invert")).toBe(5000n);
    });

    it("abs — sempre positivo", () => {
      expect(parseAmountToCents("-100,00", "brl", "abs")).toBe(10000n);
      expect(parseAmountToCents("100,00", "brl", "abs")).toBe(10000n);
    });
  });

  describe("casos inválidos", () => {
    it("retorna null para string vazia", () => {
      expect(parseAmountToCents("", "brl", "raw")).toBeNull();
    });

    it("retorna null para string só com espaços", () => {
      expect(parseAmountToCents("   ", "brl", "raw")).toBeNull();
    });

    it("retorna null para texto não numérico", () => {
      expect(parseAmountToCents("abc", "brl", "raw")).toBeNull();
    });
  });
});

describe("applyMappingToRows", () => {
  describe("mapeamento básico", () => {
    it("processa linha válida com campos mínimos", () => {
      const rows = [{ Data: "03/01/2026", Valor: "100,00" }];
      const result = applyMappingToRows(rows, mkMapping());

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("ok");
      expect(result[0].parsed?.occurredOn).toBe("2026-01-03");
      expect(result[0].parsed?.amountCents).toBe(10000n);
    });

    it("mapeia campos opcionais quando presentes", () => {
      const mapping = mkMapping({
        columns: { date: "Data", amount: "Valor", description: "Desc", notes: "Notas" },
      });
      const rows = [{ Data: "03/01/2026", Valor: "50,00", Desc: "Mercado", Notas: "Compra semanal" }];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].parsed?.description).toBe("Mercado");
      expect(result[0].parsed?.notes).toBe("Compra semanal");
    });

    it("campos opcionais não mapeados retornam null no parsed", () => {
      const rows = [{ Data: "03/01/2026", Valor: "100,00" }];
      const result = applyMappingToRows(rows, mkMapping());

      expect(result[0].parsed?.description).toBeNull();
      expect(result[0].parsed?.categoryName).toBeNull();
    });

    it("rowIndex é relativo a skipRows", () => {
      const mapping = mkMapping({ skipRows: 1 });
      const rows = [
        { Data: "cabecalho", Valor: "ignorado" },
        { Data: "03/01/2026", Valor: "100,00" },
      ];
      const result = applyMappingToRows(rows, mapping);

      expect(result).toHaveLength(1);
      expect(result[0].rowIndex).toBe(0);
    });
  });

  describe("erros de parse", () => {
    it("registra status error quando data é inválida", () => {
      const rows = [{ Data: "não-é-data", Valor: "100,00" }];
      const result = applyMappingToRows(rows, mkMapping());

      expect(result[0].status).toBe("error");
      expect(result[0].error).toContain("Data inválida");
    });

    it("registra status error quando valor é inválido", () => {
      const rows = [{ Data: "03/01/2026", Valor: "abc" }];
      const result = applyMappingToRows(rows, mkMapping());

      expect(result[0].status).toBe("error");
      expect(result[0].error).toContain("Valor inválido");
    });

    it("continua processando as demais linhas após encontrar erro", () => {
      const rows = [
        { Data: "inválida", Valor: "100,00" },
        { Data: "03/01/2026", Valor: "200,00" },
      ];
      const result = applyMappingToRows(rows, mkMapping());

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe("error");
      expect(result[1].status).toBe("ok");
    });
  });

  describe("linhas ignoradas", () => {
    it("ignora linha vazia quando ignoreEmptyRows=true", () => {
      const mapping = mkMapping({ ignoreEmptyRows: true });
      const rows = [{ Data: "", Valor: "   " }];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].status).toBe("ignored");
    });

    it("não pula linha vazia quando ignoreEmptyRows=false", () => {
      const mapping = mkMapping({ ignoreEmptyRows: false });
      const rows = [{ Data: "", Valor: "" }];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].status).toBe("error");
    });

    it("aplica regras ignoreRowsWhere pelo conteúdo da célula", () => {
      const mapping = mkMapping({
        ignoreRowsWhere: [{ column: "Tipo", contains: "SALDO" }],
      });
      const rows = [
        { Data: "03/01/2026", Valor: "100,00", Tipo: "SALDO ANTERIOR" },
        { Data: "03/01/2026", Valor: "50,00", Tipo: "COMPRA" },
      ];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].status).toBe("ignored");
      expect(result[1].status).toBe("ok");
    });
  });

  describe("mapeamento de usuário responsável", () => {
    it("resolve responsibleUserId pelo texto mapeado", () => {
      const mapping = mkMapping({
        columns: { date: "Data", amount: "Valor", responsibleUser: "Membro" },
        responsibleUserMappings: [{ text: "GABRIEL", userId: "cljk3d4e500001abcdefgh1234" }],
      });
      const rows = [{ Data: "03/01/2026", Valor: "100,00", Membro: "GABRIEL" }];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].parsed?.responsibleUserId).toBe("cljk3d4e500001abcdefgh1234");
    });

    it("retorna null quando texto não tem mapeamento", () => {
      const mapping = mkMapping({
        columns: { date: "Data", amount: "Valor", responsibleUser: "Membro" },
        responsibleUserMappings: [{ text: "GABRIEL", userId: "cljk3d4e500001abcdefgh1234" }],
      });
      const rows = [{ Data: "03/01/2026", Valor: "100,00", Membro: "OUTRO" }];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].parsed?.responsibleUserId).toBeNull();
    });

    it("mapeamento de texto é case-insensitive", () => {
      const mapping = mkMapping({
        columns: { date: "Data", amount: "Valor", responsibleUser: "Membro" },
        responsibleUserMappings: [{ text: "gabriel", userId: "cljk3d4e500001abcdefgh1234" }],
      });
      const rows = [{ Data: "03/01/2026", Valor: "100,00", Membro: "GABRIEL" }];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].parsed?.responsibleUserId).toBe("cljk3d4e500001abcdefgh1234");
    });
  });

  describe("edge cases de tamanho do array", () => {
    it("retorna [] para array de rows vazio", () => {
      expect(applyMappingToRows([], mkMapping())).toEqual([]);
    });

    it("retorna [] quando skipRows pula todas as linhas", () => {
      const mapping = mkMapping({ skipRows: 5 });
      const rows = [{ Data: "03/01/2026", Valor: "100,00" }];
      expect(applyMappingToRows(rows, mapping)).toEqual([]);
    });
  });
});
