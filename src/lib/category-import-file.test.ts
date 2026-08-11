import { describe, expect, it, vi } from "vitest";

import { parseFileToMatrix } from "@/lib/import-file";

import {
  CategoryImportFileError,
  mapJsonToCategoryRows,
  mapMatrixToCategoryRows,
  parseCategoryImportFile,
} from "./category-import-file";

// `File.prototype.arrayBuffer` não existe no `File` do jsdom (ambiente de teste) —
// só no `File` nativo do Node usado em runtime real. `parseFileToMatrix` (que já
// existe no projeto, spec 61) depende dele, então o caminho de leitura real de
// arquivo é testado aqui via mock, não com um `File` de verdade.
vi.mock("@/lib/import-file", () => ({
  parseFileToMatrix: vi.fn(),
}));

describe("mapMatrixToCategoryRows (Spec 68 §2.2 / M4)", () => {
  it("mapeia o cabeçalho exato do frame (nome, pai, seção, cor)", () => {
    const rows = mapMatrixToCategoryRows([
      ["nome", "pai", "seção", "cor"],
      ["Alimentação", "", "Moradia", "verde"],
      ["Mercado", "Alimentação", "", ""],
    ]);

    expect(rows).toEqual([
      { name: "Alimentação", parent: undefined, section: "Moradia", color: "verde" },
      { name: "Mercado", parent: "Alimentação", section: undefined, color: undefined },
    ]);
  });

  it("é tolerante a acento e caixa no cabeçalho", () => {
    const rows = mapMatrixToCategoryRows([
      ["NOME", "PAI", "SECAO", "COR"],
      ["Transporte", "", "", ""],
    ]);

    expect(rows).toEqual([
      { name: "Transporte", parent: undefined, section: undefined, color: undefined },
    ]);
  });

  it("aceita cabeçalho alternativo plausível (categoria/categoria pai)", () => {
    const rows = mapMatrixToCategoryRows([
      ["categoria", "categoria pai"],
      ["Lazer", "Restaurante"],
    ]);

    expect(rows).toEqual([
      { name: "Lazer", parent: "Restaurante", section: undefined, color: undefined },
    ]);
  });

  it("descarta linhas totalmente vazias (rodapé de planilha)", () => {
    const rows = mapMatrixToCategoryRows([
      ["nome", "pai"],
      ["Saúde", ""],
      ["", ""],
      ["", "", ""],
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Saúde");
  });

  it("descarta linha de dado com nome vazio, sem virar erro de parse", () => {
    const rows = mapMatrixToCategoryRows([
      ["nome", "pai"],
      ["", "Alimentação"],
      ["Padaria", "Alimentação"],
    ]);

    expect(rows).toEqual([
      { name: "Padaria", parent: "Alimentação", section: undefined, color: undefined },
    ]);
  });

  it("sem linha de dado (só cabeçalho) devolve lista vazia", () => {
    expect(mapMatrixToCategoryRows([["nome", "pai"]])).toEqual([]);
  });

  it("matriz totalmente vazia devolve lista vazia", () => {
    expect(mapMatrixToCategoryRows([])).toEqual([]);
  });

  it("lança CategoryImportFileError quando não encontra coluna 'nome'", () => {
    expect(() =>
      mapMatrixToCategoryRows([
        ["pai", "cor"],
        ["x", "y"],
      ]),
    ).toThrow(CategoryImportFileError);
  });
});

describe("parseCategoryImportFile (Spec 68 §2.2 / M4)", () => {
  const mockedParse = vi.mocked(parseFileToMatrix);

  it("detecta .csv pela extensão e delega a matriz ao mapeamento", async () => {
    mockedParse.mockResolvedValueOnce([
      ["nome", "pai"],
      ["Alimentação", ""],
    ]);

    const file = new File(
      ["conteúdo irrelevante — parseFileToMatrix está mockado"],
      "categorias.csv",
    );
    const rows = await parseCategoryImportFile(file);

    expect(mockedParse).toHaveBeenCalledWith(file, "csv", "auto");
    expect(rows).toEqual([
      { name: "Alimentação", parent: undefined, section: undefined, color: undefined },
    ]);
  });

  it("trata qualquer extensão que não seja .csv como planilha (xlsx/xls)", async () => {
    mockedParse.mockResolvedValueOnce([["nome"], ["Transporte"]]);

    const file = new File(["bin"], "categorias.xlsx");
    await parseCategoryImportFile(file);

    expect(mockedParse).toHaveBeenCalledWith(file, "xlsx", "auto");
  });

  it("propaga CategoryImportFileError quando o cabeçalho não tem 'nome'", async () => {
    mockedParse.mockResolvedValueOnce([
      ["pai", "cor"],
      ["x", "y"],
    ]);

    const file = new File(["x"], "categorias.csv");
    await expect(parseCategoryImportFile(file)).rejects.toThrow(CategoryImportFileError);
  });

  it("envolve falha do parser (arquivo corrompido/formato inesperado) em CategoryImportFileError", async () => {
    mockedParse.mockRejectedValueOnce(new Error("boom"));

    const file = new File(["x"], "categorias.csv");
    await expect(parseCategoryImportFile(file)).rejects.toThrow(CategoryImportFileError);
  });
});

describe("mapJsonToCategoryRows (Spec 68 §2.2 / M4 — JSON)", () => {
  it("mapeia o formato exportado pela própria tela ([{nome,pai}])", () => {
    const rows = mapJsonToCategoryRows([
      { nome: "Alimentação", pai: null },
      { nome: "Mercado", pai: "Alimentação" },
    ]);

    expect(rows).toEqual([
      { name: "Alimentação", parent: undefined, section: undefined, color: undefined },
      { name: "Mercado", parent: "Alimentação", section: undefined, color: undefined },
    ]);
  });

  it("aceita chaves em inglês (name/parent), pelos mesmos aliases do CSV", () => {
    const rows = mapJsonToCategoryRows([{ name: "Transporte", parent: "" }]);

    expect(rows).toEqual([
      { name: "Transporte", parent: undefined, section: undefined, color: undefined },
    ]);
  });

  it("mapeia `seção`/`cor` de uma planilha antiga exportada em JSON — sem destino, mas sem quebrar", () => {
    const rows = mapJsonToCategoryRows([{ nome: "Educação", seção: "Moradia", cor: "verde" }]);

    expect(rows).toEqual([
      { name: "Educação", parent: undefined, section: "Moradia", color: "verde" },
    ]);
  });

  it("descarta objetos sem campo de nome reconhecível, sem virar erro", () => {
    const rows = mapJsonToCategoryRows([{ nome: "Saúde" }, { irrelevante: true }]);

    expect(rows).toEqual([
      { name: "Saúde", parent: undefined, section: undefined, color: undefined },
    ]);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(mapJsonToCategoryRows([])).toEqual([]);
  });

  it("lança CategoryImportFileError quando o JSON não é um array", () => {
    expect(() => mapJsonToCategoryRows({ nome: "Educação" })).toThrow(CategoryImportFileError);
  });

  it("lança CategoryImportFileError quando nenhum objeto tem campo de nome", () => {
    expect(() => mapJsonToCategoryRows([{ foo: "bar" }])).toThrow(CategoryImportFileError);
  });
});

describe("parseCategoryImportFile — JSON (Spec 68 §2.2, revisão de estilo)", () => {
  it("lê um arquivo .json de verdade via FileReader (funciona no jsdom, ao contrário de arrayBuffer/text)", async () => {
    const file = new File(
      [
        JSON.stringify([
          { nome: "Alimentação", pai: null },
          { nome: "Mercado", pai: "Alimentação" },
        ]),
      ],
      "categorias.json",
      { type: "application/json" },
    );

    const rows = await parseCategoryImportFile(file);

    expect(rows).toEqual([
      { name: "Alimentação", parent: undefined, section: undefined, color: undefined },
      { name: "Mercado", parent: "Alimentação", section: undefined, color: undefined },
    ]);
  });

  it("JSON malformado vira CategoryImportFileError", async () => {
    const file = new File(["{ isso não é json"], "categorias.json");

    await expect(parseCategoryImportFile(file)).rejects.toThrow(CategoryImportFileError);
  });

  it("detecta .json pela extensão mesmo com outro `type` no File", async () => {
    const file = new File([JSON.stringify([{ nome: "Lazer" }])], "categorias.JSON");

    const rows = await parseCategoryImportFile(file);

    expect(rows).toEqual([
      { name: "Lazer", parent: undefined, section: undefined, color: undefined },
    ]);
  });
});
