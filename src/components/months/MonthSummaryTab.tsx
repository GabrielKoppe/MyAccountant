// Async Server Component — aba Summary da página de mês.
// Busca dados com getMonthSummaryData e renderiza MonthSummary.
// Envolvido em <Suspense> pelo page.tsx.

import { MonthSummary } from "@/components/dashboards/monthly/MonthSummary";
import {
  getMonthSummaryData,
  getMonthCategories,
  getMonthInstitutions,
  getMonthMembers,
} from "@/server/queries/month-page";
import { requireAccountAccess } from "@/server/auth/session";

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
  canEdit,
}: Props) {
  const { user } = await requireAccountAccess(accountId);

  const [data, categories, institutions, membersRaw] = await Promise.all([
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
    getMonthMembers(accountId),
  ]);

  const members = membersRaw.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
  }));

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
      checklistItems={data.checklistItems}
      canEdit={canEdit}
      insights={data.insights ?? []}
      filterOptions={{
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
        institutions: institutions.map((i) => ({ id: i.id, name: i.name })),
        members: members.map((m) => ({ id: m.id, name: m.name ?? m.email })),
      }}
    />
  );
}
