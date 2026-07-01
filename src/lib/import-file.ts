import type { FileMatrix } from "./csv-parser";
import type { CsvEncoding } from "./schemas/csv-import";

/**
 * Decodifica o buffer do CSV conforme o encoding escolhido.
 * "auto": decodifica como UTF-8; se aparecer o caractere de substituição (mojibake),
 * refaz como Windows-1252 — cobre extratos BR exportados em Latin-1.
 */
function decodeBuffer(buf: ArrayBuffer, encoding: CsvEncoding): string {
  if (encoding === "iso-8859-1") return new TextDecoder("iso-8859-1").decode(buf);
  if (encoding === "windows-1252") return new TextDecoder("windows-1252").decode(buf);

  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (encoding === "utf-8") return utf8;
  // auto
  if (utf8.includes("�")) return new TextDecoder("windows-1252").decode(buf);
  return utf8;
}

/**
 * Tokeniza um arquivo em matriz crua (`string[][]`), sem interpretar cabeçalho.
 * CSV: papaparse (header:false, delimitador auto-detectado) sobre o texto decodificado.
 * XLSX: primeira planilha via sheet_to_json (encoding não se aplica a binário).
 */
export async function parseFileToMatrix(
  file: File,
  fileType: "csv" | "xlsx",
  encoding: CsvEncoding,
): Promise<FileMatrix> {
  if (fileType === "csv") {
    const buf = await file.arrayBuffer();
    const text = decodeBuffer(buf, encoding);
    const Papa = (await import("papaparse")).default;
    const result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false });
    return result.data.map((r) => r.map((c) => String(c ?? "")));
  }

  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: string[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];
  return raw.map((r) => r.map((c) => String(c ?? "")));
}
