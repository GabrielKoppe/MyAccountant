// Async Server Component — aba Summary da página de mês.
// Busca dados com getMonthSummaryData e renderiza MonthSummary.
// Envolvido em <Suspense> pelo page.tsx.

import { MonthSummary } from "@/components/dashboards/monthly/MonthSummary";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import {
  getMonthSummaryData,
  getMonthCategories,
  getMonthInstitutions,
} from "@/server/queries/month-page";
import { partyDisplayMap } from "@/server/queries/responsible-party-filter";

type Props = {
  accountId: string;
  monthId: string;
  monthYear: number;
  monthMonth: number;
  prevMonthId: string | null;
  allMonthIds: string[];
  canEdit: boolean;
};

export async function MonthSummaryTab({
  accountId,
  monthId,
  monthYear,
  monthMonth,
  prevMonthId,
  allMonthIds,
  canEdit: _canEdit,
}: Props) {
  const { user } = await requireAccountAccess(accountId);

  const [data, categories, institutions, partyNames, accountTags] = await Promise.all([
    getMonthSummaryData(
      accountId,
      monthId,
      monthYear,
      monthMonth,
      user.id,
      allMonthIds,
      prevMonthId,
    ),
    getMonthCategories(accountId),
    getMonthInstitutions(accountId),
    // Parte A / A1: opções de "responsável" por partyId (todas as kinds de persona).
    partyDisplayMap(accountId),
    prisma.tag.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const parties = [...partyNames.entries()].map(([id, name]) => ({ id, name }));

  return (
    <MonthSummary
      accountId={accountId}
      monthId={monthId}
      sections={data.sections}
      sectionTotals={data.sectionTotals}
      prevSectionTotals={data.prevSectionTotals}
      monthTotal={data.monthTotal}
      transactionCount={data.totalTransactionCount}
      tables={data.tables}
      pendingTransactions={data.pendingTransactions}
      favoriteTransactions={data.favoriteTransactions}
      recentTransactions={data.recentTransactions}
      summaryBudgets={data.summaryBudgets}
      widgets={data.summaryWidgets}
      kpiCustomData={data.kpiCustomDataMap}
      filteredTransactionsData={data.filteredTransactionsMap}
      insights={data.insights ?? []}
      filterOptions={{
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
        institutions: institutions.map((i) => ({ id: i.id, name: i.name })),
        parties,
        tags: accountTags,
      }}
    />
  );
}
