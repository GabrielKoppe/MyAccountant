import type { SectionCountType } from "@prisma/client";

import { prisma } from "@/server/prisma";
import {
  applyFinancialSign,
  buildCsvRow,
  CSV_BOM,
  formatCsvNumber,
  formatDateDDMMYYYY,
} from "@/lib/export-utils";
import { MONTH_NAMES } from "@/lib/dates";

// ─── Shared transaction shape ────────────────────────────────────────────────

export type ExportTransaction = {
  occurredOn: Date;
  description: string | null;
  amountCents: bigint;
  sectionName: string;
  sectionCountType: SectionCountType;
  tableName: string;
  categoryName: string | null;
  subcategoryName: string | null;
  institutionName: string | null;
  responsibleName: string | null;
  isPending: boolean;
  isFavorite: boolean;
  notes: string | null;
};

// ─── Data fetching ────────────────────────────────────────────────────────────

export async function getMonthTransactionsForExport(
  accountId: string,
  monthId: string,
): Promise<ExportTransaction[]> {
  const rows = await prisma.transaction.findMany({
    where: { accountId, monthId },
    orderBy: [
      { section: { order: "asc" } },
      { table: { displayOrder: "asc" } },
      { occurredOn: "asc" },
    ],
    select: {
      occurredOn: true,
      amountCents: true,
      description: true,
      notes: true,
      isPending: true,
      isFavorite: true,
      section: { select: { name: true, countType: true } },
      table: { select: { name: true } },
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      institution: { select: { name: true } },
      responsibleParty: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    occurredOn: r.occurredOn,
    description: r.description,
    amountCents: r.amountCents,
    sectionName: r.section.name,
    sectionCountType: r.section.countType,
    tableName: r.table.name,
    categoryName: r.category?.name ?? null,
    subcategoryName: r.subcategory?.name ?? null,
    institutionName: r.institution?.name ?? null,
    responsibleName: r.responsibleParty?.name ?? null,
    isPending: r.isPending,
    isFavorite: r.isFavorite,
    notes: r.notes,
  }));
}

export async function getYearTransactionsForExport(
  accountId: string,
  year: number,
): Promise<(ExportTransaction & { monthNum: number })[]> {
  const rows = await prisma.transaction.findMany({
    where: { accountId, month: { year } },
    orderBy: [
      { month: { month: "asc" } },
      { section: { order: "asc" } },
      { table: { displayOrder: "asc" } },
      { occurredOn: "asc" },
    ],
    select: {
      occurredOn: true,
      amountCents: true,
      description: true,
      notes: true,
      isPending: true,
      isFavorite: true,
      section: { select: { name: true, countType: true } },
      table: { select: { name: true } },
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      institution: { select: { name: true } },
      responsibleParty: { select: { name: true } },
      month: { select: { month: true } },
    },
  });

  return rows.map((r) => ({
    occurredOn: r.occurredOn,
    description: r.description,
    amountCents: r.amountCents,
    sectionName: r.section.name,
    sectionCountType: r.section.countType,
    tableName: r.table.name,
    categoryName: r.category?.name ?? null,
    subcategoryName: r.subcategory?.name ?? null,
    institutionName: r.institution?.name ?? null,
    responsibleName: r.responsibleParty?.name ?? null,
    isPending: r.isPending,
    isFavorite: r.isFavorite,
    notes: r.notes,
    monthNum: r.month.month,
  }));
}

// ─── CSV builders ─────────────────────────────────────────────────────────────

const MONTH_CSV_HEADERS = [
  "Data",
  "Descrição",
  "Valor",
  "Seção",
  "Tabela",
  "Categoria",
  "Subcategoria",
  "Instituição",
  "Responsável",
  "Pendente",
  "Favorita",
  "Notas",
];

function txToCsvCells(tx: ExportTransaction): (string | number | null)[] {
  return [
    formatDateDDMMYYYY(tx.occurredOn),
    tx.description,
    formatCsvNumber(applyFinancialSign(tx.amountCents, tx.sectionCountType)),
    tx.sectionName,
    tx.tableName,
    tx.categoryName,
    tx.subcategoryName,
    tx.institutionName,
    tx.responsibleName,
    tx.isPending ? "Sim" : "Não",
    tx.isFavorite ? "Sim" : "Não",
    tx.notes,
  ];
}

export function buildMonthCsv(transactions: ExportTransaction[]): string {
  const lines = [buildCsvRow(MONTH_CSV_HEADERS)];
  for (const tx of transactions) {
    lines.push(buildCsvRow(txToCsvCells(tx)));
  }
  return CSV_BOM + lines.join("\r\n");
}

export function buildYearCsv(transactions: (ExportTransaction & { monthNum: number })[]): string {
  const headers = ["Mês", ...MONTH_CSV_HEADERS];
  const lines = [buildCsvRow(headers)];
  for (const tx of transactions) {
    lines.push(buildCsvRow([tx.monthNum, ...txToCsvCells(tx)]));
  }
  return CSV_BOM + lines.join("\r\n");
}

// ─── PDF data ─────────────────────────────────────────────────────────────────

export type SectionSummary = {
  name: string;
  countType: SectionCountType;
  total: bigint;
};

export type CategorySummary = {
  name: string;
  totalCents: bigint;
};

export type MonthPdfData = {
  accountName: string;
  year: number;
  month: number;
  monthLabel: string;
  monthTotal: bigint;
  sections: SectionSummary[];
  topCategories: CategorySummary[];
  transactions: ExportTransaction[];
};

export async function getMonthDataForPdf(
  accountId: string,
  monthId: string,
): Promise<MonthPdfData | null> {
  const [monthMeta, account, transactions] = await Promise.all([
    prisma.month.findFirst({
      where: { id: monthId, accountId },
      select: { year: true, month: true },
    }),
    prisma.account.findUnique({
      where: { id: accountId },
      select: { name: true },
    }),
    getMonthTransactionsForExport(accountId, monthId),
  ]);

  if (!monthMeta || !account) return null;

  // Aggregate section totals (raw sum of amountCents)
  const sectionMap = new Map<string, SectionSummary>();
  for (const tx of transactions) {
    const existing = sectionMap.get(tx.sectionName);
    if (existing) {
      existing.total += tx.amountCents;
    } else {
      sectionMap.set(tx.sectionName, {
        name: tx.sectionName,
        countType: tx.sectionCountType,
        total: tx.amountCents,
      });
    }
  }

  // Net month total applying financial sign per section
  let monthTotal = 0n;
  for (const s of sectionMap.values()) {
    if (s.countType === "add") monthTotal += s.total;
    else if (s.countType === "subtract") monthTotal -= s.total;
  }

  // Top 8 categories by absolute sum
  const catMap = new Map<string, bigint>();
  for (const tx of transactions) {
    if (!tx.categoryName) continue;
    const prev = catMap.get(tx.categoryName) ?? 0n;
    const abs = tx.amountCents < 0n ? -tx.amountCents : tx.amountCents;
    catMap.set(tx.categoryName, prev + abs);
  }
  const topCategories: CategorySummary[] = [...catMap.entries()]
    .sort((a, b) => (b[1] > a[1] ? 1 : -1))
    .slice(0, 8)
    .map(([name, totalCents]) => ({ name, totalCents }));

  return {
    accountName: account.name,
    year: monthMeta.year,
    month: monthMeta.month,
    monthLabel: `${MONTH_NAMES[monthMeta.month - 1]} ${monthMeta.year}`,
    monthTotal,
    sections: [...sectionMap.values()],
    topCategories,
    transactions,
  };
}
