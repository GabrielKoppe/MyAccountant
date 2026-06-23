// Queries para a página de mês — separadas por contexto de aba.
// Cada função é envolvida em React.cache() para deduplicate em renders RSC.
// Queries compartilhadas entre abas (categories, institutions, members, settings)
// são exposed individualmente e resolvidas pelo React.cache — chamadas por múltiplas
// abas na mesma render executam Prisma apenas uma vez.

import { cache } from "react";

import { prisma } from "@/server/prisma";
import { formatMonthLabel, getCurrentFiscalMonth } from "@/lib/dates";
import { parseHiddenColumns } from "@/lib/schemas/settings";
import {
  getMonthSections,
  getSectionTotals,
  calculateMonthTotal,
} from "@/server/services/month-service";
import { getBudgetsWithProgress } from "@/server/queries/budgets";
import { getLayout } from "@/server/services/dashboard-layout-service";
import { getKpiCustomDataMap } from "@/server/queries/kpi-custom";
import { getFilteredTransactionsMap } from "@/server/queries/filtered-transactions";
import { generateInsights } from "@/server/services/insights-service";
import { serializeTransaction } from "@/lib/serializers/transaction";
import type { TransactionRow } from "@/components/transactions/types";

// ─── Shared queries (React.cache — executam 1x por render mesmo que chamadas N vezes) ──

export const getMonthCategories = cache(async (accountId: string) =>
  prisma.category.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      subcategories: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  }),
);

export const getMonthInstitutions = cache(async (accountId: string) =>
  prisma.institution.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  }),
);

export const getMonthMembers = cache(async (accountId: string) =>
  prisma.accountMember.findMany({
    where: { accountId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  }),
);

export const getMonthAccountSettings = cache(async (accountId: string) =>
  prisma.accountSettings.findUnique({
    where: { accountId },
    select: { defaultResponsibleUserId: true, monthStartDay: true },
  }),
);

export const getMonthTableTypes = cache(async (accountId: string) =>
  prisma.tableType.findMany({
    where: { accountId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, isDefault: true },
  }),
);

export const getSourceTables = cache(async (accountId: string) => {
  const raw = await prisma.financeTable.findMany({
    where: { accountId },
    orderBy: [{ month: { year: "desc" } }, { month: { month: "desc" } }],
    select: {
      id: true,
      name: true,
      section: { select: { name: true } },
      month: { select: { year: true, month: true } },
    },
  });
  return raw.map((t) => ({
    id: t.id,
    name: t.name,
    sectionName: t.section.name,
    monthYear: formatMonthLabel(t.month.year, t.month.month),
  }));
});

// ─── Aba Summary ───────────────────────────────────────────────────

export type QuickTx = {
  id: string;
  description: string | null;
  amountCents: string;
  sectionId: string;
  sectionName: string;
  occurredOn: string;
};

export type MonthSummaryTabData = {
  sections: Awaited<ReturnType<typeof getMonthSections>>;
  sectionTotals: Record<string, string>;
  prevSectionTotals: Record<string, string> | undefined;
  monthTotal: string;
  totalTransactionCount: number;
  tables: {
    id: string;
    name: string;
    sectionId: string;
    countInMonth: boolean;
    transactionCount: number;
  }[];
  pendingTransactions: QuickTx[];
  favoriteTransactions: QuickTx[];
  recentTransactions: QuickTx[];
  summaryBudgets: Awaited<ReturnType<typeof getBudgetsWithProgress>>;
  summaryWidgets: Awaited<ReturnType<typeof getLayout>>;
  kpiCustomDataMap: Awaited<ReturnType<typeof getKpiCustomDataMap>>;
  filteredTransactionsMap: Awaited<ReturnType<typeof getFilteredTransactionsMap>>;
  insights: Awaited<ReturnType<typeof generateInsights>> | null;
  isCurrentMonth: boolean;
};

export const getMonthSummaryData = cache(
  async (
    accountId: string,
    monthId: string,
    monthYear: number,
    monthMonth: number,
    _userId: string,
    _allMonthIds: string[],
    prevMonthId: string | null,
  ): Promise<MonthSummaryTabData> => {
    const [sections, accountSettings] = await Promise.all([
      getMonthSections(accountId, monthId),
      getMonthAccountSettings(accountId),
    ]);

    const sectionIds = sections.map((s) => s.id);

    // Paraleliza totais do mês atual + anterior + budgets + tabelas do mês
    const [
      sectionTotalsRaw,
      prevTotalsRaw,
      _tableTotalsAgg,
      summaryBudgets,
      summaryWidgets,
      tablesRaw,
    ] = await Promise.all([
      getSectionTotals(accountId, monthId, sectionIds),
      prevMonthId ? getSectionTotals(accountId, prevMonthId, sectionIds) : Promise.resolve(null),
      prisma.transaction.groupBy({
        by: ["tableId"],
        where: { accountId, monthId },
        _sum: { amountCents: true },
      }),
      getBudgetsWithProgress(accountId, monthYear, monthMonth, true),
      getLayout(accountId, "month_summary"),
      prisma.financeTable.findMany({
        where: { accountId, monthId },
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          name: true,
          sectionId: true,
          countInMonth: true,
          _count: { select: { transactions: true } },
        },
      }),
    ]);

    // Dados de widgets que dependem do layout já resolvido
    const [kpiCustomDataMap, filteredTransactionsMap] = await Promise.all([
      getKpiCustomDataMap(accountId, summaryWidgets, [monthId]),
      getFilteredTransactionsMap(accountId, summaryWidgets, monthId),
    ]);

    const monthTotalRaw = calculateMonthTotal(sections, sectionTotalsRaw);
    const sectionTotals: Record<string, string> = Object.fromEntries(
      Object.entries(sectionTotalsRaw).map(([id, val]) => [id, val.toString()]),
    );
    const prevSectionTotals = prevTotalsRaw
      ? Object.fromEntries(Object.entries(prevTotalsRaw).map(([id, val]) => [id, val.toString()]))
      : undefined;

    // Busca transações para as listas rápidas (pending, favorites, recent)
    const allTransactionsRaw = await prisma.transaction.findMany({
      where: { accountId, monthId },
      orderBy: { occurredOn: "desc" },
      select: {
        id: true,
        description: true,
        amountCents: true,
        sectionId: true,
        isPending: true,
        isFavorite: true,
        occurredOn: true,
        createdAt: true,
      },
    });

    const tables = tablesRaw.map((t) => ({
      id: t.id,
      name: t.name,
      sectionId: t.sectionId,
      countInMonth: t.countInMonth,
      transactionCount: t._count.transactions,
    }));

    const totalTransactionCountReal = tablesRaw.reduce((sum, t) => sum + t._count.transactions, 0);

    const sectionNameMap = new Map(sections.map((s) => [s.id, s.name as string]));

    const pendingTransactions: QuickTx[] = allTransactionsRaw
      .filter((tx) => tx.isPending)
      .slice(0, 20)
      .map((tx) => ({
        id: tx.id,
        description: tx.description,
        amountCents: tx.amountCents.toString(),
        sectionId: tx.sectionId,
        sectionName: sectionNameMap.get(tx.sectionId) ?? "",
        occurredOn: tx.occurredOn.toISOString().slice(0, 10),
      }));

    const favoriteTransactions: QuickTx[] = allTransactionsRaw
      .filter((tx) => tx.isFavorite)
      .slice(0, 20)
      .map((tx) => ({
        id: tx.id,
        description: tx.description,
        amountCents: tx.amountCents.toString(),
        sectionId: tx.sectionId,
        sectionName: sectionNameMap.get(tx.sectionId) ?? "",
        occurredOn: tx.occurredOn.toISOString().slice(0, 10),
      }));

    const recentTransactions: QuickTx[] = [...allTransactionsRaw]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
      .map((tx) => ({
        id: tx.id,
        description: tx.description,
        amountCents: tx.amountCents.toString(),
        sectionId: tx.sectionId,
        sectionName: sectionNameMap.get(tx.sectionId) ?? "",
        occurredOn: tx.createdAt.toISOString().slice(0, 10),
      }));

    // Insights (apenas no mês atual)
    const fiscalNow = getCurrentFiscalMonth(new Date(), accountSettings?.monthStartDay ?? 1);
    const isCurrentMonth = fiscalNow.year === monthYear && fiscalNow.month === monthMonth;

    let insights = null;
    if (isCurrentMonth) {
      insights = await generateInsights(accountId, monthId, { isCurrentMonth });
    }

    return {
      sections,
      sectionTotals,
      prevSectionTotals,
      monthTotal: monthTotalRaw.toString(),
      totalTransactionCount: totalTransactionCountReal,
      tables,
      pendingTransactions,
      favoriteTransactions,
      recentTransactions,
      summaryBudgets,
      summaryWidgets,
      kpiCustomDataMap,
      filteredTransactionsMap,
      insights,
      isCurrentMonth,
    };
  },
);

// ─── Aba de Seção ──────────────────────────────────────────────────

export type SectionTable = {
  id: string;
  name: string;
  sectionId: string;
  countInMonth: boolean;
  tableTypeName: string | null;
  hiddenColumns: ReturnType<typeof parseHiddenColumns>;
  total: string;
  transactionCount: number;
};

export type SectionTabData = {
  section: { id: string; name: string; countType: string } | null;
  tables: SectionTable[];
  transactionsByTable: Record<string, TransactionRow[]>;
};

export const getSectionTabData = cache(
  async (accountId: string, monthId: string, sectionId: string): Promise<SectionTabData> => {
    const [section, tablesRaw, tableTotalsAgg] = await Promise.all([
      prisma.section.findFirst({
        where: { id: sectionId, accountId },
        select: { id: true, name: true, countType: true },
      }),
      prisma.financeTable.findMany({
        where: { accountId, monthId, sectionId },
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          name: true,
          sectionId: true,
          countInMonth: true,
          tableType: { select: { name: true, hiddenColumns: true } },
          _count: { select: { transactions: true } },
        },
      }),
      prisma.transaction.groupBy({
        by: ["tableId"],
        where: { accountId, monthId, sectionId },
        _sum: { amountCents: true },
      }),
    ]);

    const tableTotalsMap = new Map(
      tableTotalsAgg.map((r) => [r.tableId, (r._sum.amountCents ?? 0n).toString()]),
    );

    const tables: SectionTable[] = tablesRaw.map((t) => ({
      id: t.id,
      name: t.name,
      sectionId: t.sectionId,
      countInMonth: t.countInMonth,
      tableTypeName: t.tableType?.name ?? null,
      hiddenColumns: parseHiddenColumns(t.tableType?.hiddenColumns),
      total: tableTotalsMap.get(t.id) ?? "0",
      transactionCount: t._count.transactions,
    }));

    const tableIds = tablesRaw.map((t) => t.id);

    if (tableIds.length === 0) {
      return { section, tables, transactionsByTable: {} };
    }

    const allTransactionsRaw = await prisma.transaction.findMany({
      where: { accountId, monthId, sectionId, tableId: { in: tableIds } },
      orderBy: { occurredOn: "desc" },
      select: {
        id: true,
        tableId: true,
        sectionId: true,
        occurredOn: true,
        amountCents: true,
        description: true,
        notes: true,
        isPending: true,
        isFavorite: true,
        categoryId: true,
        subcategoryId: true,
        institutionId: true,
        institutionText: true,
        responsibleUserId: true,
        cardInstallment: true,
        investmentType: true,
        createdById: true,
        createdAt: true,
        updatedById: true,
        updatedAt: true,
      },
    });

    const transactionsByTable: Record<string, TransactionRow[]> = {};
    for (const tx of allTransactionsRaw) {
      const row = serializeTransaction(tx);
      if (!transactionsByTable[tx.tableId]) transactionsByTable[tx.tableId] = [];
      transactionsByTable[tx.tableId].push(row);
    }

    return { section, tables, transactionsByTable };
  },
);
