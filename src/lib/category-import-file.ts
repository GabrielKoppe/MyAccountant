// Spec 68 §2.2 (M4, revisão de estilo) — leitura do arquivo de importação de
// categorias NO CLIENTE. Aceita CSV, XLSX **e JSON**.
//
// A leitura de arquivo é sempre client-side: o servidor nunca recebe o arquivo bruto,
// só as linhas já mapeadas (`CategoryImportRow[]`). Isso é o que permite
// `previewCategoryImportAction`/`importCategoriesAction` trabalharem com um payload
// pequeno e já validado pelo schema (`categoryImportRowSchema`).
//
// CSV/XLSX reaproveitam `parseFileToMatrix` — o mesmo tokenizador do wizard de
// importação de transações (papaparse para CSV, `xlsx` para planilha). JSON é lido
// via `FileReader` (não `File.arrayBuffer()`/`.text()`: o `File` do jsdom, usado nos
// testes, não implementa nenhum dos dois — só `FileReader`, que funciona nos dois
// ambientes).

import type { CategoryImportRow } from "@/lib/category-import";
import { parseFileToMatrix } from "@/lib/import-file";

/** Erro de leitura/mapeamento do arquivo — a UI traduz para `import.parseError`. */
export class CategoryImportFileError extends Error {}

type ColumnKey = "name" | "parent" | "section" | "color";

/**
 * Aliases aceitos por coluna/chave, já sem acento e em minúsculas (a comparação
 * normaliza o cabeçalho do CSV/XLSX ou a chave do objeto JSON do mesmo jeito antes de
 * casar). Cobre o cabeçalho exato do frame (`nome, pai, seção, cor`), o formato
 * exportado pela própria tela (`{ nome, pai }`) e variações plausíveis em inglês.
 */
const HEADER_ALIASES: Record<ColumnKey, readonly string[]> = {
  name: ["nome", "categoria", "name"],
  parent: ["pai", "categoria pai", "parent"],
  section: ["secao", "secao padrao", "section"],
  color: ["cor", "color"],
};

/** Mesma técnica de `normalize()` em `lib/category-import.ts` — tolerante a acento/caixa. */
function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function findColumn(headers: string[], key: ColumnKey): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of HEADER_ALIASES[key]) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Mapeia uma matriz crua (primeira linha = cabeçalho) para `CategoryImportRow[]`.
 *
 * Função PURA — sem `File`, sem parser — para o teste exercitar o mapeamento de
 * cabeçalho tolerante sem precisar montar um `File` de verdade.
 *
 * Linhas totalmente vazias são descartadas antes de procurar o cabeçalho (planilha
 * exportada costuma trazer uma linha em branco no fim). Uma linha com `nome` vazio
 * também é descartada aqui: `classifyCategoryImport` marcaria como erro "nome vazio",
 * mas isso seria ruído — planilha real tem linha de rodapé/observação sem dado.
 */
export function mapMatrixToCategoryRows(matrix: string[][]): CategoryImportRow[] {
  const body = matrix.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (body.length < 2) return []; // só cabeçalho (ou nada) — nenhuma linha de dado

  const [headerRow, ...dataRows] = body;
  const nameCol = findColumn(headerRow, "name");
  if (nameCol === -1) {
    throw new CategoryImportFileError('Coluna "nome" não encontrada no cabeçalho');
  }
  const parentCol = findColumn(headerRow, "parent");
  const sectionCol = findColumn(headerRow, "section");
  const colorCol = findColumn(headerRow, "color");

  const cell = (cells: string[], col: number) => (col === -1 ? "" : (cells[col] ?? "").trim());

  return dataRows
    .filter((cells) => cell(cells, nameCol) !== "")
    .map((cells) => ({
      name: cell(cells, nameCol),
      parent: cell(cells, parentCol) || undefined,
      section: cell(cells, sectionCol) || undefined,
      color: cell(cells, colorCol) || undefined,
    }));
}

/** Valor de um campo de um objeto JSON, casando a chave pelos mesmos aliases do CSV. */
function pickJsonField(item: Record<string, unknown>, key: ColumnKey): string {
  for (const [rawKey, value] of Object.entries(item)) {
    if (!HEADER_ALIASES[key].includes(normalizeHeader(rawKey))) continue;
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    return ""; // `null`/`undefined`/objeto — "não informado", não um valor a mapear
  }
  return "";
}

/**
 * Mapeia o JSON já parseado (`JSON.parse`) para `CategoryImportRow[]`.
 *
 * Aceita tanto `[{ nome, pai }]` (o formato exportado pela própria tela — ver
 * `categories-export.ts`) quanto variações em inglês (`{ name, parent }`), pelos
 * mesmos aliases do CSV/XLSX. Função PURA: recebe o valor já decodificado, não o
 * `File` — o teste exercita o mapeamento sem depender de `FileReader`.
 */
export function mapJsonToCategoryRows(data: unknown): CategoryImportRow[] {
  if (!Array.isArray(data)) {
    throw new CategoryImportFileError("O JSON precisa ser uma lista de categorias");
  }

  const items = data.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
  );

  const rows = items
    .map((item) => ({
      name: pickJsonField(item, "name"),
      parent: pickJsonField(item, "parent") || undefined,
      section: pickJsonField(item, "section") || undefined,
      color: pickJsonField(item, "color") || undefined,
    }))
    .filter((row) => row.name !== "");

  // Mesmo raciocínio do CSV: `[]` é só "sem linhas", não erro. Um array com itens mas
  // NENHUM campo de nome reconhecido é que indica o formato errado.
  if (data.length > 0 && rows.length === 0) {
    throw new CategoryImportFileError('Nenhum objeto do JSON tem o campo "nome"');
  }

  return rows;
}

/** Lê o texto de um `File` via `FileReader` — funciona no browser e no jsdom dos testes. */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o arquivo"));
    reader.readAsText(file);
  });
}

/**
 * Lê o `File` escolhido pelo usuário (CSV, XLSX ou JSON) e devolve as linhas já
 * mapeadas. Nada além disso sobe para o servidor — a promessa da tela ("nada é
 * gravado antes de você conferir") começa aqui, no cliente, nunca vendo o arquivo bruto.
 */
export async function parseCategoryImportFile(file: File): Promise<CategoryImportRow[]> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".json")) {
    let text: string;
    try {
      text = await readFileAsText(file);
    } catch {
      throw new CategoryImportFileError("Não foi possível ler o arquivo");
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new CategoryImportFileError("Não foi possível ler o arquivo");
    }

    return mapJsonToCategoryRows(data);
  }

  const isCsv = lowerName.endsWith(".csv");
  let matrix: string[][];
  try {
    matrix = await parseFileToMatrix(file, isCsv ? "csv" : "xlsx", "auto");
  } catch {
    throw new CategoryImportFileError("Não foi possível ler o arquivo");
  }

  return mapMatrixToCategoryRows(matrix);
}
