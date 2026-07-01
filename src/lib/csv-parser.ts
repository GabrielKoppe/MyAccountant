import { parse as dateParse, isValid as dateIsValid, format as dateFormat } from "date-fns";
import type { ImportMapping } from "./schemas/csv-import";

export type ParsedRow = Record<string, string>;

/** Matriz crua do arquivo: uma linha por array de células, sem interpretar cabeçalho. */
export type FileMatrix = string[][];

/**
 * Desambigua nomes de cabeçalho como o papaparse faz com `header:true`:
 * célula vazia vira `coluna_<i>`; nome repetido ganha sufixo `_1`, `_2`, …
 */
function disambiguateHeaders(cells: string[]): string[] {
  const seen = new Map<string, number>();
  return cells.map((cell, i) => {
    const base = String(cell ?? "").trim() || `coluna_${i}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count}`;
  });
}

/**
 * Deriva `headers` + `rows` de uma matriz crua aplicando `skipRows` (linhas físicas
 * puladas no topo, antes do cabeçalho) e `hasHeader`.
 *
 * - `hasHeader=true`: `headers = matrix[skipRows]` (desambiguado); dados a partir de `skipRows + 1`.
 * - `hasHeader=false`: gera `coluna_0…coluna_N` pela maior largura dos dados; dados a partir de `skipRows`.
 *
 * Como as `rows` retornadas já excluem o preâmbulo, `applyMappingToRows` itera a partir do índice 0.
 */
export function deriveHeadersAndRows(
  matrix: FileMatrix,
  skipRows: number,
  hasHeader: boolean,
): { headers: string[]; rows: ParsedRow[] } {
  const start = Math.max(0, skipRows);
  const body = matrix.slice(start);

  if (body.length === 0) return { headers: [], rows: [] };

  let headers: string[];
  let dataRows: string[][];

  if (hasHeader) {
    headers = disambiguateHeaders(body[0]);
    dataRows = body.slice(1);
  } else {
    const width = body.reduce((max, r) => Math.max(max, r.length), 0);
    headers = Array.from({ length: width }, (_, i) => `coluna_${i}`);
    dataRows = body;
  }

  const rows: ParsedRow[] = dataRows.map((cells) =>
    Object.fromEntries(headers.map((h, i) => [h, String(cells[i] ?? "")])),
  );

  return { headers, rows };
}

export type PreviewRow = {
  rowIndex: number;
  status: "ok" | "error" | "ignored";
  original: ParsedRow;
  parsed?: {
    occurredOn: string; // YYYY-MM-DD
    amountCents: bigint;
    description: string | null;
    notes: string | null;
    categoryName: string | null;
    subcategoryName: string | null;
    institutionName: string | null;
    cardInstallment: string | null;
    investmentType: string | null;
    responsibleUserId: string | null;
    originalAmountCents: bigint | null;
    originalCurrency: string | null;
    exchangeRate: number | null;
  };
  error?: string;
};

// date-fns v3 uses lowercase tokens: dd, yyyy (not DD, YYYY)
function normalizeDateFormat(fmt: string): string {
  return fmt.replace(/DD/g, "dd").replace(/YYYY/g, "yyyy").replace(/YY/g, "yy");
}

export function parseDateString(str: string, fmt: string): string | null {
  if (!str.trim()) return null;
  const normalizedFmt = normalizeDateFormat(fmt);
  const ref = new Date(2000, 0, 1);
  const parsed = dateParse(str.trim(), normalizedFmt, ref);
  if (!dateIsValid(parsed)) return null;
  return dateFormat(parsed, "yyyy-MM-dd");
}

export function parseAmountToCents(
  raw: string,
  format: "brl" | "us",
  signMode: "raw" | "invert" | "abs",
): bigint | null {
  let s = raw.trim();
  if (!s) return null;

  // Strip currency symbols
  s = s
    .replace(/R\$\s*/g, "")
    .replace(/\$\s*/g, "")
    .trim();

  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1).trim();
  } else if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1).trim();
  }

  let normalized: string;
  if (format === "brl") {
    // 1.234,56 → 1234.56
    normalized = s.replace(/\./g, "").replace(",", ".");
    if (normalized.endsWith(".")) normalized += "00";
  } else {
    // 1,234.56 → 1234.56
    normalized = s.replace(/,/g, "");
  }

  const num = parseFloat(normalized);
  if (isNaN(num) || !isFinite(num)) return null;

  let cents = Math.round(num * 100);
  if (negative) cents = -cents;

  if (signMode === "invert") cents = -cents;
  else if (signMode === "abs") cents = Math.abs(cents);

  return BigInt(cents);
}

export function applyMappingToRows(rows: ParsedRow[], mapping: ImportMapping): PreviewRow[] {
  const results: PreviewRow[] = [];

  // `skipRows` já foi aplicado na tokenização (deriveHeadersAndRows): as `rows` aqui
  // não incluem o preâmbulo, então iteramos a partir do índice 0.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const relIdx = i;

    // Skip empty rows
    if (mapping.ignoreEmptyRows && Object.values(row).every((v) => !v.trim())) {
      results.push({ rowIndex: relIdx, status: "ignored", original: row, error: "Linha vazia" });
      continue;
    }

    // Apply ignoreRowsWhere rules
    let ignored = false;
    for (const rule of mapping.ignoreRowsWhere) {
      const cell = row[rule.column] ?? "";
      if (cell.includes(rule.contains)) {
        ignored = true;
        break;
      }
    }
    if (ignored) {
      results.push({
        rowIndex: relIdx,
        status: "ignored",
        original: row,
        error: "Filtrado por regra",
      });
      continue;
    }

    // Parse date
    const dateStr = row[mapping.columns.date] ?? "";
    const parsedDate = parseDateString(dateStr, mapping.dateFormat);
    if (!parsedDate) {
      results.push({
        rowIndex: relIdx,
        status: "error",
        original: row,
        error: `Data inválida: "${dateStr}"`,
      });
      continue;
    }

    // Parse amount
    const amountStr = row[mapping.columns.amount] ?? "";
    const parsedAmount = parseAmountToCents(amountStr, mapping.amountFormat, mapping.amountSign);
    if (parsedAmount === null) {
      results.push({
        rowIndex: relIdx,
        status: "error",
        original: row,
        error: `Valor inválido: "${amountStr}"`,
      });
      continue;
    }

    results.push({
      rowIndex: relIdx,
      status: "ok",
      original: row,
      parsed: {
        occurredOn: parsedDate,
        amountCents: parsedAmount,
        description: mapping.columns.description ? row[mapping.columns.description] || null : null,
        notes: mapping.columns.notes ? row[mapping.columns.notes] || null : null,
        categoryName: mapping.columns.category ? row[mapping.columns.category] || null : null,
        subcategoryName: mapping.columns.subcategory
          ? row[mapping.columns.subcategory] || null
          : null,
        institutionName: mapping.columns.institution
          ? row[mapping.columns.institution] || null
          : null,
        cardInstallment: mapping.columns.cardInstallment
          ? row[mapping.columns.cardInstallment] || null
          : null,
        investmentType: mapping.columns.investmentType
          ? row[mapping.columns.investmentType] || null
          : null,
        responsibleUserId: (() => {
          if (!mapping.columns.responsibleUser) return null;
          const cellVal = (row[mapping.columns.responsibleUser] ?? "").trim();
          if (!cellVal || !mapping.responsibleUserMappings?.length) return null;
          const found = mapping.responsibleUserMappings.find(
            (m) => m.text.toLowerCase() === cellVal.toLowerCase(),
          );
          return found?.userId ?? null;
        })(),
        ...(() => {
          // Moeda estrangeira: só preenche quando fxAmount mapeado e valor > 0
          if (!mapping.columns.fxAmount)
            return { originalAmountCents: null, originalCurrency: null, exchangeRate: null };
          const fxCents = parseAmountToCents(
            row[mapping.columns.fxAmount] ?? "",
            mapping.amountFormat,
            "abs",
          );
          if (!fxCents || fxCents === 0n)
            return { originalAmountCents: null, originalCurrency: null, exchangeRate: null };
          const currency =
            (mapping.columns.fxCurrency ? (row[mapping.columns.fxCurrency] ?? "").trim() : "") ||
            mapping.fxCurrencyDefault ||
            null;
          let rate: number | null = null;
          if (mapping.columns.fxRate) {
            const rateRaw = (row[mapping.columns.fxRate] ?? "").replace(",", ".").trim();
            const rateNum = parseFloat(rateRaw);
            if (!isNaN(rateNum) && rateNum > 0) rate = rateNum;
          }
          return { originalAmountCents: fxCents, originalCurrency: currency, exchangeRate: rate };
        })(),
      },
    });
  }

  return results;
}
