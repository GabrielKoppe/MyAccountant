/**
 * Detecção de parcelamentos em linhas de import CSV.
 * Analisa as linhas já mapeadas (PreviewRow) em cascata de 3 sinais:
 * 1. Campo `cardInstallment` com padrão X/Y
 * 2. Regex /(\d+)\/(\d+)$/ na descrição
 * 3. (descrição normalizada, amountCents) repetida em N>1 linhas (série suspeita)
 */

import type { PreviewRow } from "./csv-parser";

export type InstallmentSuggestion = {
  /** Índice único da sugestão (para controle de aceite/rejeição) */
  id: string;
  /** Descrição normalizada do grupo */
  groupDescription: string;
  /** Total de parcelas esperadas (de X/Y) */
  installmentCount: number;
  /** Linhas pertencentes ao grupo, com rowIndex e número de parcela */
  lines: { rowIndex: number; installmentNumber: number }[];
  /** Valor total somado de todas as linhas do grupo */
  totalAmountCents: bigint;
  /** Alta = sinal explícito (X/Y); Média = repetição sem X/Y */
  confidence: "high" | "medium";
};

/** Remove o padrão X/Y do final de uma string e normaliza espaços */
function normalizeDescription(desc: string): string {
  return desc
    .replace(/\s+\d+\/\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Detecta grupos de parcelamento nas linhas de preview.
 * Retorna sugestões ordenadas por confiança (high primeiro).
 */
export function detectInstallments(previewRows: PreviewRow[]): InstallmentSuggestion[] {
  const okRows = previewRows.filter((r) => r.status === "ok" && r.parsed);
  const suggestions: InstallmentSuggestion[] = [];
  const usedRowIndices = new Set<number>();

  // ─── Sinal 1: campo cardInstallment no formato X/Y ───────────────────────
  const byCardInstallmentKey = new Map<
    string,
    { rowIndex: number; installmentNumber: number; installmentCount: number; amountCents: bigint }[]
  >();

  for (const row of okRows) {
    const ci = row.parsed!.cardInstallment;
    if (!ci) continue;
    const match = /^(\d+)\/(\d+)$/.exec(ci.trim());
    if (!match) continue;
    const [, numStr, totalStr] = match;
    const num = parseInt(numStr, 10);
    const total = parseInt(totalStr, 10);
    if (num < 1 || total < 2 || num > total) continue;

    const normalizedDesc = normalizeDescription(row.parsed!.description ?? "");
    const key = `${normalizedDesc}::${total}`;
    const arr = byCardInstallmentKey.get(key) ?? [];
    arr.push({
      rowIndex: row.rowIndex,
      installmentNumber: num,
      installmentCount: total,
      amountCents: row.parsed!.amountCents,
    });
    byCardInstallmentKey.set(key, arr);
  }

  for (const [, items] of byCardInstallmentKey) {
    if (items.length < 1) continue;
    const { installmentCount } = items[0];
    const sortedItems = [...items].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const totalAmountCents = sortedItems.reduce((s, i) => s + i.amountCents, 0n);
    const id = `ci:${items[0].rowIndex}`;
    suggestions.push({
      id,
      groupDescription:
        normalizeDescription(
          previewRows.find((r) => r.rowIndex === items[0].rowIndex)?.parsed?.description ?? "",
        ) || "Parcelamento",
      installmentCount,
      lines: sortedItems.map((i) => ({
        rowIndex: i.rowIndex,
        installmentNumber: i.installmentNumber,
      })),
      totalAmountCents,
      confidence: "high",
    });
    for (const item of items) usedRowIndices.add(item.rowIndex);
  }

  // ─── Sinal 2: regex /(\d+)\/(\d+)$/ na descrição ─────────────────────────
  const byDescriptionPattern = new Map<
    string,
    { rowIndex: number; installmentNumber: number; installmentCount: number; amountCents: bigint }[]
  >();

  for (const row of okRows) {
    if (usedRowIndices.has(row.rowIndex)) continue;
    const desc = row.parsed!.description ?? "";
    const match = /(\d+)\/(\d+)\s*$/.exec(desc);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    if (num < 1 || total < 2 || num > total) continue;

    const normalizedDesc = normalizeDescription(desc);
    const key = `${normalizedDesc}::${total}`;
    const arr = byDescriptionPattern.get(key) ?? [];
    arr.push({
      rowIndex: row.rowIndex,
      installmentNumber: num,
      installmentCount: total,
      amountCents: row.parsed!.amountCents,
    });
    byDescriptionPattern.set(key, arr);
  }

  for (const [, items] of byDescriptionPattern) {
    if (items.length < 1) continue;
    const { installmentCount } = items[0];
    const sortedItems = [...items].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const totalAmountCents = sortedItems.reduce((s, i) => s + i.amountCents, 0n);
    const id = `desc:${items[0].rowIndex}`;
    suggestions.push({
      id,
      groupDescription:
        normalizeDescription(
          previewRows.find((r) => r.rowIndex === items[0].rowIndex)?.parsed?.description ?? "",
        ) || "Parcelamento",
      installmentCount,
      lines: sortedItems.map((i) => ({
        rowIndex: i.rowIndex,
        installmentNumber: i.installmentNumber,
      })),
      totalAmountCents,
      confidence: "high",
    });
    for (const item of items) usedRowIndices.add(item.rowIndex);
  }

  // ─── Sinal 3: (descrição normalizada, amountCents) repetida ──────────────
  const byDescAmount = new Map<string, { rowIndex: number; amountCents: bigint }[]>();

  for (const row of okRows) {
    if (usedRowIndices.has(row.rowIndex)) continue;
    const normalizedDesc = normalizeDescription(row.parsed!.description ?? "");
    if (!normalizedDesc) continue;
    const key = `${normalizedDesc}::${row.parsed!.amountCents}`;
    const arr = byDescAmount.get(key) ?? [];
    arr.push({ rowIndex: row.rowIndex, amountCents: row.parsed!.amountCents });
    byDescAmount.set(key, arr);
  }

  for (const [, items] of byDescAmount) {
    if (items.length < 2) continue; // Only flag if repeated
    const installmentCount = items.length;
    const totalAmountCents = items.reduce((s, i) => s + i.amountCents, 0n);
    const id = `repeat:${items[0].rowIndex}`;
    suggestions.push({
      id,
      groupDescription:
        normalizeDescription(
          previewRows.find((r) => r.rowIndex === items[0].rowIndex)?.parsed?.description ?? "",
        ) || "Parcelamento",
      installmentCount,
      lines: items.map((i, idx) => ({
        rowIndex: i.rowIndex,
        installmentNumber: idx + 1,
      })),
      totalAmountCents,
      confidence: "medium",
    });
  }

  // Sort: high confidence first
  return suggestions.sort((a, b) => {
    if (a.confidence === "high" && b.confidence !== "high") return -1;
    if (a.confidence !== "high" && b.confidence === "high") return 1;
    return 0;
  });
}
