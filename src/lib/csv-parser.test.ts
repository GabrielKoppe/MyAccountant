import { describe, expect, it } from "vitest";

import type { AliasCandidate } from "./aliases/match";
import {
  parseDateString,
  parseAmountToCents,
  applyMappingToRows,
  deriveHeadersAndRows,
  detectAmountFormat,
} from "./csv-parser";
import type { ImportMapping } from "./schemas/csv-import";
import { DEFAULT_MAPPING } from "./schemas/csv-import";

type MappingOverrides = Partial<Omit<ImportMapping, "columns">> & {
  columns?: Partial<ImportMapping["columns"]>;
};

function mkMapping(overrides: MappingOverrides = {}): ImportMapping {
  return {
    ...DEFAULT_MAPPING,
    ...overrides,
    columns: { ...DEFAULT_MAPPING.columns, date: "Data", amount: "Valor", ...overrides.columns },
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

  describe("variantes de separador", () => {
    it("analisa YYYY/MM/DD", () => {
      expect(parseDateString("2026/01/03", "YYYY/MM/DD")).toBe("2026-01-03");
    });

    it("analisa DD-MM-YYYY", () => {
      expect(parseDateString("03-01-2026", "DD-MM-YYYY")).toBe("2026-01-03");
    });

    it("analisa DD.MM.YYYY", () => {
      expect(parseDateString("03.01.2026", "DD.MM.YYYY")).toBe("2026-01-03");
    });
  });

  describe("data com hora", () => {
    it("ignora a parte de hora separada por espaço", () => {
      expect(parseDateString("01/06/2026 10:26:53", "DD/MM/YYYY")).toBe("2026-06-01");
    });

    it("ignora a parte de hora separada por T (ISO)", () => {
      expect(parseDateString("2026-06-01T10:26:53", "YYYY-MM-DD")).toBe("2026-06-01");
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

    it("trata parênteses como negativo (padrão contábil)", () => {
      expect(parseAmountToCents("(1.234,56)", "brl", "raw")).toBe(-123456n);
    });

    it("parênteses com símbolo de moeda", () => {
      expect(parseAmountToCents("(R$ 50,00)", "brl", "raw")).toBe(-5000n);
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
        columns: { date: "Data", amount: "Valor", description: "Desc", notes: ["Notas"] },
      });
      const rows = [
        { Data: "03/01/2026", Valor: "50,00", Desc: "Mercado", Notas: "Compra semanal" },
      ];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].parsed?.description).toBe("Mercado");
      expect(result[0].parsed?.notes).toBe("Notas: Compra semanal");
    });

    it("junta múltiplas colunas de notas como 'Coluna: valor' por linha", () => {
      const mapping = mkMapping({
        columns: { date: "Data", amount: "Valor", notes: ["Data Contábil", "Número do cartão"] },
      });
      const rows = [
        {
          Data: "03/01/2026",
          Valor: "50,00",
          "Data Contábil": "04/01/2026",
          "Número do cartão": "1234",
        },
      ];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].parsed?.notes).toBe("Data Contábil: 04/01/2026\nNúmero do cartão: 1234");
    });

    it("ignora colunas de nota vazias e retorna null quando nenhuma tem valor", () => {
      const mapping = mkMapping({
        columns: { date: "Data", amount: "Valor", notes: ["A", "B"] },
      });
      const rows = [{ Data: "03/01/2026", Valor: "50,00", A: "", B: "  " }];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].parsed?.notes).toBeNull();
    });

    it("campos opcionais não mapeados retornam null no parsed", () => {
      const rows = [{ Data: "03/01/2026", Valor: "100,00" }];
      const result = applyMappingToRows(rows, mkMapping());

      expect(result[0].parsed?.description).toBeNull();
      expect(result[0].parsed?.categoryName).toBeNull();
    });

    it("rowIndex é sequencial a partir de 0 (skipRows já aplicado na tokenização)", () => {
      // skipRows não re-pula linhas aqui: as rows já vêm sem o preâmbulo
      const mapping = mkMapping({ skipRows: 5 });
      const rows = [
        { Data: "03/01/2026", Valor: "100,00" },
        { Data: "04/01/2026", Valor: "200,00" },
      ];
      const result = applyMappingToRows(rows, mapping);

      expect(result).toHaveLength(2);
      expect(result[0].rowIndex).toBe(0);
      expect(result[1].rowIndex).toBe(1);
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

  describe("modo entrada/saída (creditDebit)", () => {
    function mkCd(overrides: MappingOverrides = {}): ImportMapping {
      return mkMapping({
        amountMode: "creditDebit",
        amountFormat: "us", // extratos tipo C6 usam ponto decimal (5514.04)
        ...overrides,
        columns: {
          date: "Data",
          amount: "",
          amountCredit: "Entrada",
          amountDebit: "Saida",
          ...overrides.columns,
        },
      });
    }

    it("entrada vira valor positivo", () => {
      const rows = [{ Data: "01/06/2026", Entrada: "5514.04", Saida: "0.00" }];
      const result = applyMappingToRows(rows, mkCd());

      expect(result[0].status).toBe("ok");
      expect(result[0].parsed?.amountCents).toBe(551404n);
    });

    it("saída vira valor negativo", () => {
      const rows = [{ Data: "01/06/2026", Entrada: "0.00", Saida: "249.00" }];
      const result = applyMappingToRows(rows, mkCd());

      expect(result[0].parsed?.amountCents).toBe(-24900n);
    });

    it("lê valor de saída em módulo mesmo se vier com sinal no arquivo", () => {
      const rows = [{ Data: "01/06/2026", Entrada: "0.00", Saida: "-249.00" }];
      const result = applyMappingToRows(rows, mkCd());

      expect(result[0].parsed?.amountCents).toBe(-24900n);
    });

    it("erro quando entrada e saída estão ambas vazias", () => {
      const rows = [{ Data: "01/06/2026", Entrada: "", Saida: "" }];
      const result = applyMappingToRows(rows, mkCd());

      expect(result[0].status).toBe("error");
    });

    it("funciona com apenas a coluna de saída mapeada", () => {
      const mapping = mkCd({
        columns: { date: "Data", amount: "", amountDebit: "Saida" },
      });
      const rows = [{ Data: "01/06/2026", Saida: "80.00" }];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].parsed?.amountCents).toBe(-8000n);
    });

    it("amountSign=invert troca o sinal do resultado combinado", () => {
      const mapping = mkCd({ amountSign: "invert" });
      const rows = [{ Data: "01/06/2026", Entrada: "0.00", Saida: "249.00" }];
      const result = applyMappingToRows(rows, mapping);

      expect(result[0].parsed?.amountCents).toBe(24900n);
    });
  });

  describe("edge cases de tamanho do array", () => {
    it("retorna [] para array de rows vazio", () => {
      expect(applyMappingToRows([], mkMapping())).toEqual([]);
    });
  });
});

describe("deriveHeadersAndRows", () => {
  it("deriva cabeçalho e dados sem skipRows (arquivo simples)", () => {
    const matrix = [
      ["Data", "Valor"],
      ["03/01/2026", "100,00"],
      ["04/01/2026", "200,00"],
    ];
    const { headers, rows } = deriveHeadersAndRows(matrix, 0, true);

    expect(headers).toEqual(["Data", "Valor"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Data: "03/01/2026", Valor: "100,00" });
  });

  it("pula preâmbulo de banco antes do cabeçalho (estilo C6)", () => {
    const matrix = [
      ["EXTRATO DE CONTA CORRENTE C6 BANK"],
      [""],
      ["Agência: 1 / Conta: 209476796"],
      ["Data Lançamento", "Descrição", "Entrada(R$)"],
      ["01/06/2026", "Pix recebido", "5514.04"],
    ];
    const { headers, rows } = deriveHeadersAndRows(matrix, 3, true);

    expect(headers).toEqual(["Data Lançamento", "Descrição", "Entrada(R$)"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Data Lançamento"]).toBe("01/06/2026");
    expect(rows[0]["Entrada(R$)"]).toBe("5514.04");
  });

  it("gera colunas indexadas quando hasHeader=false", () => {
    const matrix = [
      ["03/01/2026", "100,00"],
      ["04/01/2026", "200,00"],
    ];
    const { headers, rows } = deriveHeadersAndRows(matrix, 0, false);

    expect(headers).toEqual(["coluna_0", "coluna_1"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ coluna_0: "03/01/2026", coluna_1: "100,00" });
  });

  it("desambigua cabeçalhos repetidos e vazios", () => {
    const matrix = [
      ["Data", "Data", ""],
      ["a", "b", "c"],
    ];
    const { headers, rows } = deriveHeadersAndRows(matrix, 0, true);

    expect(headers).toEqual(["Data", "Data_1", "coluna_2"]);
    expect(rows[0]).toEqual({ Data: "a", Data_1: "b", coluna_2: "c" });
  });

  it("preenche células ausentes com string vazia", () => {
    const matrix = [
      ["Data", "Valor", "Obs"],
      ["03/01/2026", "100,00"], // sem a 3ª célula
    ];
    const { rows } = deriveHeadersAndRows(matrix, 0, true);

    expect(rows[0].Obs).toBe("");
  });

  it("retorna vazio quando skipRows descarta todo o arquivo", () => {
    const matrix = [["Data", "Valor"]];
    expect(deriveHeadersAndRows(matrix, 5, true)).toEqual({ headers: [], rows: [] });
  });
});

describe("detectAmountFormat", () => {
  it("detecta US quando ponto é decimal (ex: C6 5514.04)", () => {
    expect(detectAmountFormat(["5514.04", "0.00", "249.00"])).toBe("us");
  });

  it("detecta BRL quando vírgula é decimal", () => {
    expect(detectAmountFormat(["1.234,56", "249,00", "50,00"])).toBe("brl");
  });

  it("detecta BRL com ambos separadores (vírgula à direita)", () => {
    expect(detectAmountFormat(["1.234,56"])).toBe("brl");
  });

  it("detecta US com ambos separadores (ponto à direita)", () => {
    expect(detectAmountFormat(["1,234.56"])).toBe("us");
  });

  it("trata ponto com 3 dígitos como milhar (BRL)", () => {
    expect(detectAmountFormat(["1.234", "5.678"])).toBe("brl");
  });

  it("retorna null para valores inteiros ambíguos", () => {
    expect(detectAmountFormat(["100", "250", ""])).toBeNull();
  });

  it("retorna null para lista vazia", () => {
    expect(detectAmountFormat([])).toBeNull();
  });
});

describe("applyMappingToRows — apelidos (spec 61 Fase 5)", () => {
  function mkAlias(overrides: Partial<AliasCandidate> = {}): AliasCandidate {
    return {
      id: "alias-1",
      trigger: "CEG",
      triggerNormalized: "ceg",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("marca appliedAliasId quando a descrição casa um apelido", () => {
    const rows = [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG" }];
    const mapping = mkMapping({ columns: { date: "Data", amount: "Valor", description: "Desc" } });
    const result = applyMappingToRows(rows, mapping, [mkAlias()]);

    expect(result[0].parsed?.appliedAliasId).toBe("alias-1");
  });

  it("appliedAliasId é null quando nenhum apelido casa", () => {
    const rows = [{ Data: "03/01/2026", Valor: "100,00", Desc: "Mercado" }];
    const mapping = mkMapping({ columns: { date: "Data", amount: "Valor", description: "Desc" } });
    const result = applyMappingToRows(rows, mapping, [mkAlias()]);

    expect(result[0].parsed?.appliedAliasId).toBeNull();
  });

  it("appliedAliasId é null (default) sem o parâmetro aliases — retrocompatível", () => {
    const rows = [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG" }];
    const mapping = mkMapping({ columns: { date: "Data", amount: "Valor", description: "Desc" } });
    const result = applyMappingToRows(rows, mapping);

    expect(result[0].parsed?.appliedAliasId).toBeNull();
  });

  it("linha de erro (sem parsed) não é marcada", () => {
    const rows = [{ Data: "não-é-data", Valor: "100,00", Desc: "pagamento CEG" }];
    const mapping = mkMapping({ columns: { date: "Data", amount: "Valor", description: "Desc" } });
    const result = applyMappingToRows(rows, mapping, [mkAlias()]);

    expect(result[0].status).toBe("error");
    expect(result[0].parsed).toBeUndefined();
  });

  it("desempate por gatilho mais longo entre dois apelidos casados", () => {
    const rows = [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG SA" }];
    const mapping = mkMapping({ columns: { date: "Data", amount: "Valor", description: "Desc" } });
    const aliases = [
      mkAlias({ id: "short", trigger: "CEG", triggerNormalized: "ceg" }),
      mkAlias({ id: "long", trigger: "CEG SA", triggerNormalized: "ceg sa" }),
    ];
    const result = applyMappingToRows(rows, mapping, aliases);

    expect(result[0].parsed?.appliedAliasId).toBe("long");
  });
});
