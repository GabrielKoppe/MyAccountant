import type { SectionCountType } from "@prisma/client";

export function toAccountSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function applyFinancialSign(amountCents: bigint, countType: SectionCountType): number {
  const reais = Number(amountCents) / 100;
  if (countType === "subtract") return -reais;
  return reais;
}

export function formatCsvNumber(value: number): string {
  return value.toFixed(2);
}

export function formatDateDDMMYYYY(date: Date): string {
  const d = date.getUTCDate().toString().padStart(2, "0");
  const mo = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}/${mo}/${y}`;
}

export const CSV_BOM = "﻿";

export function buildCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells
    .map((cell) => {
      if (cell === null || cell === undefined) return "";
      const str = String(cell);
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(",");
}
