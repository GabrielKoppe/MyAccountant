// Spec 68 §2.2 (EST-04, revisão de estilo) — export CSV e JSON da árvore de categorias,
// espelhando o formato aceito pela importação (M4): `nome, pai`. Nem `seção` nem `cor`
// entram aqui — a primeira porque `Category.defaultSectionId` foi abandonado pela UI
// nesta revisão (a coluna "Seção padrão" nunca fez sentido — ver o schema), a segunda
// porque categoria nunca teve cor própria (D2/D7).
//
// Funções PURAS, sem DOM: quem baixa o arquivo (Blob + `URL.createObjectURL`) é o
// `CategoriesManager` — aqui só o texto, para o teste não precisar de jsdom.

import { buildCsvRow, CSV_BOM } from "@/lib/export-utils";

import type { CategoryItem } from "./categories-tree";

type ExportRow = { nome: string; pai: string | null };

/** Uma linha por categoria de topo (`pai` nulo) e uma por subcategoria (`pai` = nome
 * da categoria) — a mesma forma para CSV e JSON, só o formato de saída muda. */
function toExportRows(categories: CategoryItem[]): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const category of categories) {
    rows.push({ nome: category.name, pai: null });
    for (const sub of category.subcategories) {
      rows.push({ nome: sub.name, pai: category.name });
    }
  }
  return rows;
}

const CSV_HEADER = ["nome", "pai"];

export function buildCategoriesExportCsv(categories: CategoryItem[]): string {
  const lines = [buildCsvRow(CSV_HEADER)];
  for (const row of toExportRows(categories)) {
    lines.push(buildCsvRow([row.nome, row.pai ?? ""]));
  }

  // BOM: mesmo padrão de `export-service.ts` — sem ele, Excel abre acentuação
  // corrompida em vez de UTF-8.
  return CSV_BOM + lines.join("\r\n");
}

/** Mesma forma que o import aceita de volta (`mapJsonToCategoryRows`) — reimportar o
 * arquivo exportado é um round-trip, não um formato à parte. */
export function buildCategoriesExportJson(categories: CategoryItem[]): string {
  return JSON.stringify(toExportRows(categories), null, 2);
}
